GPS Tracker Server
==================

Server collects GPS coordinates from [GPS Tracker Receiver] (https://github.com/insonifi/gps-tracker-receiver), through (IronMQ) [http://www.iron.io/mq]. Collected coordinates are stored in Postgres database. Web-backend provides realtime access to live updates and stored data by use of Web Sockets.
