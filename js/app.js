'use strict';


// Declare app level module which depends on filters, and services
angular.module('core', ['core.filters', 'core.services', 'core.directives', 'core.controllers', 'btford.socket-io', 'leaflet-directive'])
.extended($root, {
  center: {
      lat: 56.9496,
      lng: 24.1040,
      zoom: 12
    },
  defaults: {
      maxZoom: 18
    }
  });
