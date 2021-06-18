function CheckIsString(Value,Context)
{
	if ( typeof Value != 'string' )
		throw `Value(${Context}) is not a string`;
	return Value;
}


const Params = {};

Params.RepositoryPath = CheckIsString( process.env.GIT_DIR || '../Git', 'process.env.GIT_DIR' );
Params.DraftBranch = 'main';
Params.RepositoryUrl = 'https://github.com/NewChromantics/Tour_Test.git';
Params.SyncDelaySecs = 60;
Params.GitPushUsername = CheckIsString( process.env.GIT_AUTHUSER, 'process.env.GIT_AUTHUSER' );
Params.GitPushPassword = CheckIsString( process.env.GIT_AUTHPASS, 'process.env.GIT_AUTHPASS' );

//	node.js exports
if ( module )
{
	module.exports =
	{
		Params,
	};
}
