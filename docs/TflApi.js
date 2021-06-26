import * as Pop from './PopUtils.js'

import {StationStopPoints,StationFormattedNames,LineFormattedNames} from './Stations.js'


export const TrainWaitTimeSecs = 13;
export const ThrottleUpdateNextSecs = 3;
export const ThrottleUpdateAllSecs = 600;


//	filtering only these modes [of transport]
const ModeNames = 
[
'overground',
'tube',
'dlr'
];

//	specific syntax for node.js
let FetchFunction = (typeof fetch != 'undefined') ? fetch : null;

//	for node, we need to define fetch() outside this file
export function SetFetchFunction(NewFetchFunction)
{
	FetchFunction = NewFetchFunction;
}

export const TrainData = [];

function GetStationUrl(StopPoint)
{
	return `https://api.tfl.gov.uk/StopPoint/${StopPoint}/Arrivals`;
}

async function GetStationJson(StationCode)
{
	const StopPoint = StationStopPoints[StationCode];
	const Url = GetStationUrl(StopPoint);
	
	//const headers = new Headers();
	//headers.append('Access-Control-Allow-Origin','*');
	
	const FetchParams = {};
	//FetchParams.mode = 'no-cors';
	FetchParams.mode = 'cors';
	//FetchParams.headers = headers;
	//FetchParams.redirect = 'follow';
	
	const Response = await FetchFunction( Url, FetchParams );
	//const TextPromise = Response.text();
	const JsonPromise = Response.json();
	//const Body = await TextPromise;
	const Json = await JsonPromise;
	
	return Json;
}

export function GetTimeNowSecs()
{
	const Ms = Date.now();
	//return Math.floor(Pop.GetTimeNowMs() / 1000);
	const Secs = Math.floor( Ms / 1000 );
	return Secs;
}

function TimestampToTimeSecs(DateString)
{
	//2021-06-20T15:26:19Z
	const DateValue = Date.parse(DateString);
	const Secs = DateValue.getTime();
	return Secs;
}

//	parse XML
/*
 <S Code="CTN" Mess="" N="Camden Town." CurTime="15:45:59">
",<P N="Northbound - Platform 1" Num="1" TrackCode="TN60164" NextTrain="false">
",  <T TrainId="2943082" LCID="141" SetNo="054" TripNo="11" SecondsTo="0" TimeTo="-" Location="At Platform" Destination="Edgware via CX" InputDest="EDG3-X (EDG3//EDG3-X) [EDG3=X/EDG3=X]" DestCode="153" Order="0" DepartTime="14:45:33" DepartInterval="0" Departed="0" Direction="0" IsStalled="0" TrackCode="TN60165" LN="N" LeadingCarNo="51641" />
", */
async function GetStationTrains(StationJson,StationCode,FetchTimeSecs)
{
	function MinimiseTrain(TrainData)
	{
		//	filter out non underground/overground trains
		if ( ModeNames.indexOf(TrainData.modeName) == -1 )
		{
			console.log(`Filtered out train mode ${TrainData.modeName}`);
			return null;
		}
			
		const Train = {};
		Train.AddedTime = FetchTimeSecs;
		Train.ArrivalTime = FetchTimeSecs + TrainData.timeToStation;
		Train.Line = LineFormattedNames[TrainData.lineId] || TrainData.lineId;
		Train.Station = StationFormattedNames[StationCode];
		Train.StationCode = StationCode;
		Train.PredictionId = TrainData.id;	//	seems to be unique (string)
		
		//	"delete this data from your cache"
		if ( TrainData.operationType == 2 )
		{
			console.log(`Got Delete Cache operation; ${JSON.stringify(TrainData)}`);
			Train.ArrivalTime = null;
		}
		
		return Train;
	}
	
	const Trains = StationJson.map(MinimiseTrain).filter( t => t!=null );
	return Trains;
	/*
	//	regex for xml 
	const TrainPattern = `<T [.*] TimeTo="(.*)"[.*]/>`;
	const TrainMatches = [...Xml.matchAll(TrainPattern)];
	
	function MatchToTrain(Match)
	{
		const Train = {};
		Train.ArrivalTime = Match[1];
		return Train;
	}
	const Trains = TrainMatches.map(MatchToTrain);
	return Trains;
	*/
}

function PushTrainData(Train)
{
	function MatchTrain(OldTrain)
	{
		//	arrival time changes too much, use the predicition id
		return OldTrain.PredictionId == Train.PredictionId;
		/*
		if ( OldTrain.ArrivalTime != Train.ArrivalTime )
			return false;
		if ( OldTrain.Line != Train.Line )
			return false;
		if ( OldTrain.Station != Train.Station )
			return false;
		*/
		return true;
	}
	
	//	insert into train data, but detect duplicate
	const ExistingTrain = TrainData.find(MatchTrain);
	if ( ExistingTrain )
	{
		//	update data (arrival time might have changed) on the train
		Object.assign(ExistingTrain,Train);
		return;
	}
	
	TrainData.push(Train);
}


async function CheckStationHasTrains(StationCode)
{
	const StopPoint = StationStopPoints[StationCode];
	const Url = `https://api.tfl.gov.uk/StopPoint/${StopPoint}`;

	const FetchParams = {};
	FetchParams.mode = 'cors';
	const Response = await fetch( Url, FetchParams );
	const Json = await Response.json();

	const MatchingModes = Json.modes.filter( Mode => ModeNames.indexOf(Mode)!= -1);
	if ( MatchingModes.length == 0 )
		throw `${StationCode} doesn't have underground trains, only; ${Json.modes.join(',')}`;

	console.log(`${StationCode} supports ${MatchingModes.join(',')}`);
	return Json;
}

async function RefreshStation(StationCode)
{
	const TimeSecs = GetTimeNowSecs();
	const Json = await GetStationJson(StationCode);
	const Trains = await GetStationTrains(Json,StationCode,TimeSecs);
	
	//	throw an error if we query a station with no tube trains
	if ( !Trains.length )
	{
		await CheckStationHasTrains(StationCode);
	}
	
	Trains.forEach( PushTrainData );
}


export async function RefreshStationsThread(OnTrainDataChanged,OnError,OnDebug)
{
	OnTrainDataChanged = OnTrainDataChanged || console.log;
	OnError = OnError || console.error;
	OnDebug = OnDebug || console.info;
	
	let CurrentIndex = 0;

	async function WaitSecs(Secs)
	{
		for ( let i=0;	i<Secs;	i++ )
		{
			await Pop.Yield( 1*1000 );
		}
		UpdateDomNodes();
	}
	
	//	for debugging shuffle the order we fetch
	let StationNames = Object.keys(StationStopPoints);
	Pop.ShuffleArray(StationNames);

	while(true)
	{
		const CurrentStation = StationNames[CurrentIndex];
		try
		{
			OnDebug(`Fetching ${StationFormattedNames[CurrentStation]}...`);
			await RefreshStation(CurrentStation);
			OnTrainDataChanged();
		}
		catch(e)
		{
			OnError(`Refreshing station ${CurrentStation} error: ${e}`);
			//await WaitSecs(1);
		}
		CurrentIndex = (CurrentIndex+1) % StationNames.length;
		await Pop.Yield( ThrottleUpdateNextSecs * 1000 );
		
		if ( CurrentIndex == 0 )
		{
			console.log(`Updated all trains`);
			await Pop.Yield( ThrottleUpdateAllSecs*1000 );
		}
	}
}

const Default = 'TflApi.js';
export default Default;
