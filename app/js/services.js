'use strict';

/* Services */


// Demonstrate how to register services
// In this case it is a simple value service.
angular.module('core.services', []).
  value('version', (new Date()));
