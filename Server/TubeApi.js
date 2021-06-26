import fetch from 'node-fetch'
import Pop from './PopApi.js'
import * as TubeApi from '../docs/TflApi.js' 
import * as Stations from '../docs/Stations.js' 



class Train_t
{
	constructor()
	{
	}
}

//	if this is set, we return it to client
let ServerError = null;
let LastStationsChangedTime = null;

function OnError(Error)
{
	console.error(`Error: ${Error}`);
	ServerError = Error;
}

function OnTrainDataChanged()
{
	console.log(`Train data changed`);
	LastStationsChangedTime = true;//Pop.GetTimeNowMs();
}

function OnDebug(Debug)
{
	console.log(Debug);
}

try
{
	TubeApi.SetFetchFunction( fetch );
	TubeApi.RefreshStationsThread(OnTrainDataChanged,OnError,OnDebug).catch(OnError);
}
catch(e)
{
	OnError(e);
}


export function GetTrainData()
{
	console.log(`GetTrainData()`);
	return TubeApi.TrainData;
}

export function GetNextTrains(MaxFutureSecs)
{
	if ( !MaxFutureSecs )
		throw `GetNextTrains(MaxFutureSecs=${MaxFutureSecs}) not specified`;
	const Now = TubeApi.GetTimeNowSecs();
	//const MaxFutureSecs = 60*3;
	const MaxPastSecs = TubeApi.TrainWaitTimeSecs;
	
	function TrainWithinScope(Train)
	{
		const ArrivalTime = Train.ArrivalTime - Now;
		if ( ArrivalTime < -MaxPastSecs )
			return false;
		if ( ArrivalTime > MaxFutureSecs )
			return false;
		return true;
	}
	
	function TrainArrivalTimeCompare(a,b)
	{
		if ( a.ArrivalTime < b.ArrivalTime )
			return -1;
		if ( a.ArrivalTime > b.ArrivalTime )
			return 1;
		return 0;
	}
	
	function TrainToCsv(Train)
	{
		const ArrivalSecs = Train.ArrivalTime - Now;
		const Station = Stations.StationShortNames[Train.StationCode] || Train.StationCode;
		const Line = Stations.LineShortNames[Train.Line] || Train.Line;
		return `${Station}/${Line}/${ArrivalSecs}`;
	}
	
	let Trains = TubeApi.TrainData.filter(TrainWithinScope);
	Trains = Trains.sort( TrainArrivalTimeCompare );
	const Csv = Trains.map( TrainToCsv );
	
	return Csv;
}
