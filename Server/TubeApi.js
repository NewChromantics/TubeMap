import fetch from 'node-fetch'
import Pop from './PopApi.js'
import * as TubeApi from '../docs/TflApi.js' 


class Train_t
{
	constructor()
	{
	}
}

//	if this is set, we return it to client
let ServerError = null;
let StationTrains = {};	//	[Station TLA] = [Train_t]

function OnError(Error)
{
	console.error(`Error: ${Error}`);
	ServerError = Error;
}


function GetStationXmlUrl(Station,Line)
{
	const Server = "cloud.tfl.gov.uk";
	const Port = 80;
	const Url = `http://${Server}:${Port}/TrackerNet/PredictionDetailed/${Line}/${Station}`;
	return Url;
}

async function GetStationXml(Station,Line)
{
	const Url = GetStationXmlUrl(Station,Line);
	console.log(`Fetch ${Url}`);
	const Response = await fetch(Url);
	console.log(`Status Code: ${Response.status}`);
	const Xml = await Response.text();
	console.log(`Fetch result ${Xml.slice(0,30)}...`);
	return Xml;
}
	
function UpdateTrainData(Train)
{
	const Station = Train.Station;
	//console.log(`UpdateTrain in ${Station}`);
	if ( !StationTrains.hasOwnProperty(Station) )
		StationTrains[Station] = [];
	
	StationTrains[Station].push(Train);
	//console.log(`UpdateTrainData`,StationTrains);
}

async function GetStationTrains(Xml,Station,Line)
{
	//	regex 
	//const TrainPattern = `<T (.*)[.*] TimeTo="(.*)"[.*]/>`;
	const TrainPattern = `<T(.*)TimeTo="([^\"]*)"(.*)LN="([^\"]*)"(.*)/>`;
	const TrainMatches = [...Xml.matchAll(TrainPattern)];
	
	//console.log(`TrainMatches=${TrainMatches}`);
	console.log(`TrainMatches x${TrainMatches.length}`);
	function MatchToTrain(Match)
	{
		const Time = (Match[2] == '-') ? '0:00' : Match[2];	//	1:00
		const LineCode = Match[4];
		const Train = new Train_t();
		Train.ArrivalTime = Time;
		Train.Line = LineCode; 	//	gr: maybe dont need to pull this out
		Train.Station = Station;
		//console.log(`train; ${JSON.stringify(Train)}`);
		return Train;
	}
	const Trains = TrainMatches.map(MatchToTrain);
	return Trains;
}

async function RefreshStation(Station,Line)
{
	console.log(`RefreshStation(${Station},${Line})`);
	const Xml = await GetStationXml(Station,Line);
	const Trains = await GetStationTrains(Xml,Station,Line);
	Trains.forEach( UpdateTrainData );
}

async function UpdateStationsThread()
{
	let CurrentStationIndex = 0;
	let CurrentLineIndex = 0;

	while(true)
	{
		const CurrentStation = Tube.Stations[CurrentStationIndex];
		const CurrentLine = Tube.Lines[CurrentLineIndex];
		try
		{
			await RefreshStation(CurrentStation,CurrentLine);
			console.log(StationTrains);
		}
		catch(e)
		{
			console.error(`Refreshing station ${CurrentStation}(#${CurrentLine}) error: ${e}`);
			await Pop.Yield(1*1000);
		}
		
		CurrentLineIndex = (CurrentLineIndex+1) % Tube.Lines.length;
		
		//	done all lines, next station
		if ( CurrentLineIndex == 0 )
		{
			CurrentStationIndex = (CurrentStationIndex+1) % Tube.Stations.length;
			
			//	done all stations
			//	pause when we've looped
			if ( CurrentStationIndex == 0 )
			{
				console.log(`Iterated all stations, pausing...`);
				await Pop.Yield(100*1000);
			}
		}
		
		await Pop.Yield(0*1000);
	}
}
//UpdateStationsThread().catch(OnError);


export function GetLatestStationTrains()
{
	if ( ServerError )
		throw ServerError;
		
	console.log(`GetLatestStationTrains`,StationTrains);

	return StationTrains;
}



export function GetStationNextTrains()
{
	if ( ServerError )
		throw ServerError;

	const OutputTrains = [];
	function PushTrain(Station,Train)
	{
		OutputTrains.push(Train);
	}

	for ( let Station in StationTrains )
	{
		//	get one with lowest time
		const Trains = StationTrains[Station];
		if ( !Trains.length )
			continue;
		PushTrain(Station,Trains[0]);
	}
	
	function TrainToLine(Train)
	{
		return `${Train.Station},${Train.Line}@${Train.ArrivalTime}`;
	}
	const OutputLines = OutputTrains.map(TrainToLine);
	return OutputLines.join('\n');
}

