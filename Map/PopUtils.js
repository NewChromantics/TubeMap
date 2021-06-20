const Default = 'PopUtils Module';
export default Default;



export function GetTimeNowMs()
{
	return performance.now();
}


export async function FetchJson(Url)
{
	const Params = {};
	Params.mode = 'no-cors';
	Params.method = 'get';
	//Params.signal = Signal;	//	abort controller
	
	const Fetched = await fetch(Url,Params);
	if (!Fetched.ok)
		throw `fetch error, status=${Fetched.statusText}`;
	const Contents = await Fetched.json();
	return Contents;
}



//	create a promise function with the Resolve & Reject functions attached so we can call them
export function CreatePromise()
{
	let Callbacks = {};
	let PromiseHandler = function(Resolve,Reject)
	{
		Callbacks.Resolve = Resolve;
		Callbacks.Reject = Reject;
	}
	let Prom = new Promise(PromiseHandler);
	Prom.Resolve = Callbacks.Resolve;
	Prom.Reject = Callbacks.Reject;
	return Prom;
}


export async function LoadFilePromptAsFile(Filename)
{
	const OnChangedPromise = CreatePromise();
	const InputElement = window.document.createElement('input');
	InputElement.setAttribute('type','file');
	//InputElement.multiple = true;
	InputElement.setAttribute('accept','Any/*');

	function OnFilesChanged(Event)
	{
		//	extract files from the control
		const Files = Array.from(InputElement.files);
		console.log(`OnChanged: ${JSON.stringify(Files)}`);
		OnChangedPromise.Resolve(Files);
		InputElement.files = null;
	}
	//InputElement.addEventListener('input',OnFilesChanged,false);
	InputElement.addEventListener('change',OnFilesChanged,false);
	InputElement.click();

	const Files = await OnChangedPromise;
	if (!Files.length)
		throw `User selected no files`;

	//	read file contents
	//	currently only interested in first
	const File = Files[0];
	//const Contents = await File.blob();
	const Contents = File;
	return Contents;
}


export async function LoadFilePromptAsArrayBuffer(Filename)
{
	const File = await LoadFilePromptAsFile(Filename);
	const Buffer = await File.arrayBuffer();
	const Typed = new Uint8Array(Buffer);
	return Typed;
}

export async function LoadFilePromptAsImageBitmap(Filename)
{
	const Blob = await LoadFilePromptAsFile(Filename);
	const ImageOptions = {};
	const Bitmap = await createImageBitmap( Blob, ImageOptions );
	return Bitmap;
}


export function base64ToBytes(base64) 
{
	const binary_string = window.atob(base64);
	const len = binary_string.length;
	const bytes = new Uint8Array(len);
	for (var i = 0; i < len; i++) 
	{
		bytes[i] = binary_string.charCodeAt(i);
	}
	//return bytes.buffer;
	return bytes;
}

export function IsTypedArray(Data)
{
	if ( !Data )
		return false;
	if ( !Data.byteLength )
		return false;
	return true;
}


export function FileSizeToString(SizeBytes)
{
	const SizeKb = SizeBytes / 1024;
	const SizeMb = SizeKb / 1024;
	const SizeKbString = SizeKb.toFixed(2) + 'kb';
	const SizeMbString = SizeMb.toFixed(2) + 'mb';
	
	if ( SizeMb >= 1.0 )
		return SizeMbString;
	
	return SizeKbString;
}


export async function Yield(Milliseconds)
{
	const Promise = CreatePromise();
	setTimeout( Promise.Resolve, Milliseconds );
	return Promise;
}



//	gr: this needs a fix like FetchOnce
export async function LoadFileAsImageAsync(Filename)
{
	//	return cache if availible, if it failed before, try and load again
	const Cache = FileCache.GetOrFalse(Filename);
	if ( Cache !== false )
	{
		if ( IsObjectInstanceOf(Cache,PopImage) )
			return Cache;

		Warning(`Converting cache from ${typeof Cache} to Pop.Image...`);
		const CacheImage = await new PopImage();
		CacheImage.LoadPng(Cache);
		FileCache.Set(Filename,CacheImage);
		return CacheImage;
	}
	
	function LoadHtmlImageAsync()
	{
		let Promise = CreatePromise();
		const HtmlImage = new Image();
		HtmlImage.onload = function ()
		{
			Promise.Resolve(HtmlImage);
		};
		HtmlImage.addEventListener('load', HtmlImage.onload, false);
		HtmlImage.onerror = function (Error)
		{
			Promise.Reject(Error);
		}
		HtmlImage.crossOrigin = "anonymous";
		//  trigger load
		HtmlImage.src = '';
		HtmlImage.src = Filename;
		return Promise;
	}

	//	the API expects to return an image, so wait for the load,
	//	then make an image. This change will have broken the Pop.Image(Filename)
	//	constructor as it uses the asset cache, which is only set after this
	const HtmlImage = await LoadHtmlImageAsync();
	const Img = new PopImage(HtmlImage);
	FileCache.Set(Filename,Img);
	return Img;
}

//	gr: I don't think this will auto detect if mimetype is omitted
//		so it's here as an example
export async function BytesToBitmap(Bytes,MimeType="image/png")
{
	//	re-using browser's loader
	//const PngBlob = new Blob( [ Bytes ], { type: "image/png" } );
	const PngBlob = new Blob( [ Bytes ], { type: MimeType } );
	//const ImageUrl = URL.createObjectURL( PngBlob );
	const Bitmap = createImageBitmap( PngBlob );
	//const Image = await Pop.LoadFileAsImageAsync(ImageUrl);
	//const Bitmap = Image.Pixels;

	//	free memory
	//URL.revokeObjectURL(ImageUrl);
	return Bitmap;
}
