import os from 'os'
import ExpressModule from 'express'
import * as TubeApi from './TubeApi.js';


const CorsOrigin = process.env.CorsOrigin || '*';
const ErrorStatusCode = 500;
const HttpListenPort = 80;

const OrgPattern = `([A-Za-z]+)`;

const RootUrlPattern = new RegExp(`^/$`);	


//	API routing
const HttpServerApp = ExpressModule();


//HttpServerApp.get(RootUrlPattern,HandleStationCsv);
HttpServerApp.get('/data',HandleDataJson);
HttpServerApp.get('/next',HandleNextCsv);

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


async function HandleDataJson(Request,Response)
{
	async function Run(Request)
	{
		const Data = await TubeApi.GetTrainData();
		return JSON.stringify(Data,null,'\t');
	}
	return HandleResponse( Run, Request, Response );
}

async function HandleNextCsv(Request,Response)
{
	async function Run(Request)
	{
		const FutureSecs = 60;
		const NextTrains = await TubeApi.GetNextTrains(FutureSecs);
		return NextTrains.join('\n');
	}
	return HandleResponse( Run, Request, Response );
}

