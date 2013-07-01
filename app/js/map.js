map = function () {
  var map,
  ajaxRequest,
  plotlist,
  plotlayers=[],
  // set up the map
  map = new L.Map('map');

  // create the tile layer with correct attribution
  var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var osmAttrib='Map data © OpenStreetMap contributors';
  var osm = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 18, attribution: osmAttrib});		

  // start the map in South-East England
  map.setView(new L.LatLng(56.95, 24.1),12);
  map.addLayer(osm);
  return map
}()
