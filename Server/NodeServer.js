const os = require( 'os' );
const Pop = require('./PopApi');
const ExpressModule = require('express');
const TubeApi = require('./TubeApi');

const CorsOrigin = process.env.CorsOrigin || '*';
const ErrorStatusCode = 500;
const HttpListenPort = 80;

const OrgPattern = `([A-Za-z]+)`;

const RootUrlPattern = new RegExp(`^/$`);	


//	API routing
const HttpServerApp = ExpressModule();


//HttpServerApp.get(RootUrlPattern,HandleStationCsv);
HttpServerApp.get('/',HandleStationCsv);
HttpServerApp.get('/next',HandleStationNextCsv);


const HttpServer = HttpServerApp.listen( HttpListenPort, () => console.log( `http server on ${JSON.stringify(HttpServer.address())}` ) );



async function HandleResponse(Function,Request,Response)
{
	try
	{
		let Output = await Function(Request);

		//	if a string returned, auto convert to string content
		if ( typeof Output == typeof '' )
		{
			const Content = Output;
			Output = {};
			Output.Content = Content;
		}		

		//	PopImageServer generic code
		Output.StatusCode = Output.StatusCode || 200;
		Output.Mime = Output.Mime || 'text/plain';

		Response.statusCode = Output.StatusCode;
		Response.setHeader('Content-Type',Output.Mime);
		
		Response.end(Output.Content);
	}
	catch (e)
	{
		console.log(`HandleResponse error -> ${e}`);
		Response.statusCode = ErrorStatusCode;
		Response.setHeader('Content-Type','text/plain');
		Response.end(`Error ${e}`);
	}
}



async function HandleStationCsv(Request,Response)
{
	async function Run(Request)
	{
		const LatestStations = await TubeApi.GetLatestStationTrains();
		return JSON.stringify(LatestStations,null,'\t');
	}
	return HandleResponse( Run, Request, Response );
}

async function HandleStationNextCsv(Request,Response)
{
	async function Run(Request)
	{
		const NextTrains = await TubeApi.GetStationNextTrains();
		//return JSON.stringify(NextTrains,null,'\t');
		return NextTrains;
	}
	return HandleResponse( Run, Request, Response );
}
