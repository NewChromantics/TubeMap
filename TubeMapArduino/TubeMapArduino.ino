/*
    This sketch sends data via HTTP GET requests to data.sparkfun.com service.

    You need to get streamId and privateKey at data.sparkfun.com and paste them
    below. Or just customize this script to talk to other HTTP servers.

*/

#include <ESP8266WiFi.h>

const char* ssid     = "EnglishCustard";
const char* password = "Basement123";

const char* host = "tube.newchromantics.com";
const char* url   = "/next";


typedef int StationCode_t;
typedef int LineCode_t;


enum LineCodes
{
    Line_Invalid  = 0,
    Line_Northern,
    Line_Overground,

    Line_Max
};

enum StationCodes
{
    Station_Invalid  = 0,

    Station_EUS,
    Station_CAM,
    Station_HOL,
    Station_KINGS,
    Station_EARL,

    Station_Max
};

class Train_t
{
public:
  Train_t(){};
  Train_t(StationCode_t Station,LineCode_t Line,int32_t ArrivalTime) :
    mLine ( Line ),
    mStation  ( Station ),
    mArrivalTime  ( ArrivalTime )
  {
  }
  
  LineCode_t        mLine = Line_Invalid;
  StationCode_t     mStation = Station_Invalid;
  int32_t           mArrivalTime = -999;
};



void setup() {
  Serial.begin(115200);
  delay(10);

  // We start by connecting to a WiFi network

  Serial.println();
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  /* Explicitly set the ESP8266 to be a WiFi-client, otherwise, it by default,
     would try to act as both a client and an access-point and could cause
     network-issues with your other WiFi-devices on your WiFi-network. */
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

LineCode_t GetLineCode(String LineName)
{
    if ( LineName == "NO" ) return Line_Northern;
    return Line_Invalid;
}

StationCode_t GetStationCode(String StationName)
{
    //if ( StationName == "Holborn" ) return 'HOLB';
    return Station_Invalid;
}


uint32_t GetTimeNowSecs()
{
  //  time since boot, will loop after ~50 days
  unsigned long Ms = millis();
  return Ms / 1000;
}


#define MAX_TRAINS  50
Train_t gTrainData[MAX_TRAINS];
uint32_t gTrainDataCount = 0;
uint32_t LastFetchTimeSecs = 0;

//  clear old train data and set clock to now
void NewTrains()
{
  gTrainDataCount = 0;
  LastFetchTimeSecs = GetTimeNowSecs();
  Serial.print("New train clock time: ");
  Serial.println(LastFetchTimeSecs);
}

void PushTrain(const Train_t& NewTrain)
{
   // write over tail entry
   if ( gTrainDataCount < MAX_TRAINS )
   {
      gTrainData[gTrainDataCount] = NewTrain;
   }
   gTrainDataCount++;
}


bool FetchNewTrainData()
{
  Serial.print("connecting to ");
  Serial.println(host);

  // Use WiFiClient class to create TCP connections
  WiFiClient client;
  const int httpPort = 80;
  if (!client.connect(host, httpPort)) {
    Serial.println("connection failed");
    return false;
  }

  // We now create a URI for the request
 
  Serial.print("Requesting URL: ");
  Serial.println(url);

  // This will send the request to the server
  client.print(String("GET ") + url + " HTTP/1.1\r\n" +
               "Host: " + host + "\r\n" +
               "Connection: close\r\n\r\n");
  unsigned long timeout = millis();
  while (client.available() == 0) {
    if (millis() - timeout > 5000) {
      Serial.println(">>> Client Timeout !");
      client.stop();
      return false;
    }
  }

  //  read http headers
  //  todo: detect bad request
  bool GotEndOfHeaders = false;
  while ( !GotEndOfHeaders )
  {
    String line = client.readStringUntil('\n');
    if ( line.length() > 0 )
      line.remove( line.length()-1 );
    Serial.print("Header...");
    Serial.println(line);
    if ( line == "" )
    {
        GotEndOfHeaders = true;
        Serial.println("Got headers.");
    }
    
  }

  NewTrains();
  
  //  gr: if this doesnt get all data in time, won't it end early?
  while (client.available()) 
  {
      String StationName = client.readStringUntil('/');
      auto Station = GetStationCode(StationName);
      String LineName = client.readStringUntil('/');
      auto Line = GetLineCode(LineName);
      String ArrivalTimeString = client.readStringUntil('\n');
      auto ArrivalTime = ArrivalTimeString.toInt();
      Train_t Train( Station, Line, ArrivalTime );
      PushTrain( Train );
      Serial.print("New Train; station=");
      Serial.print(StationName);
      Serial.print("Line=");
      Serial.print(LineName);
      Serial.print("Arrival time=");
      Serial.print(ArrivalTime);
      Serial.println("");
  }

  Serial.println();
  Serial.println("closing connection");
  return true;
}

int GetLedFromStation(StationCode_t Station)
{
    return 1;
}

void UpdateStationLeds()
{
    //  LED map
    bool LedMap[Station_Max] = {false};

    //  get time relative to train data
    auto Now = GetTimeNowSecs() - LastFetchTimeSecs;
    auto MinArrivalTime = Now - 13;
    auto MaxArrivalTime = Now - 0;
    for ( int t=0;  t<gTrainDataCount;  t++ )
    {
      auto& Train = gTrainData[t];
      if ( Train.mArrivalTime < MinArrivalTime )
        continue;
      if ( Train.mArrivalTime > MaxArrivalTime )
        continue;
      int LedIndex = GetLedFromStation(Train.mStation);
      LedMap[LedIndex] = true;
    }

    for ( int i=0;  i<Station_Max;  i++ )
      Serial.print( LedMap[i] ? "X" : "_" );
    Serial.println("");
}

int InternalClockSecs = 0;
void loop() 
{
    //  calc & update LEDs
    UpdateStationLeds();

    //  check if its time to fetch
    //  how long since we updated?
    int MaxTimeBetweenFetch = 60; //  data is 60secs max, but we should re-fetch on the last station time (or something near that)
    auto TimeSinceFetch = GetTimeNowSecs() - LastFetchTimeSecs;
    if ( TimeSinceFetch > MaxTimeBetweenFetch || LastFetchTimeSecs == 0 )
    {
        FetchNewTrainData();
    }

    //  could make this smarter and work out how long until expected LED change
    delay(1000);
}
