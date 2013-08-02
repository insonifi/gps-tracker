'use strict';

/* Directives */


angular.module('core.directives', [])
 .directive('dtpicker', function () {
    return {
      restrict: 'A',
      replace: true,
      transclude: false,
      link: function (scope, element, attrs) {
        var today = (new Date()).valueOf() + (-(new Date()).getTimezoneOffset() * 60 * 1000);
        if (attrs.period == 'start') {
          today = today - 24 * 3600000;
        }
        var date_string = (new Date(today)).toISOString().replace(/T/, ' ').slice(0,-8),
          newElem = $(element).appendDtpicker({
					  dateFormat: 'h:mm DD.MM.YYYY',
					  current: date_string
				  });
				scope[attrs.period] = element.val();
        element.bind('input', function () {
          scope[attrs.period] = element.val();
        });
      }
    }
  })
  .directive('waypointsList', function () {
    return {
      restrict: 'A',
      replace: true,
      controller: ['$scope', '$element', '$attrs', 'socket', function (scope, element, attrs, socket) {
        scope.waypoints = [];
        scope.done = true;
        socket.on('query-waypoint', function (waypoint) {
          if(scope.done) {
            scope.waypoints = [];
            scope.done = false
          }
          waypoint.timestamp = new Date(waypoint.timestamp); /* convert to date */
          waypoint.show_address = false;
          scope.waypoints.push(waypoint);
          scope.$apply('waypoints');
        });
        socket.on('result-address', function (response) {
          var i,
            length = scope.waypoints.length;
          for (i = 0; i < length; i += 1) {
            if (scope.waypoints[i].lat === response.lat
              || scope.waypoints[i].long === response.long) {
                scope.waypoints[i].address = response.address;
              }
            }
        });
        socket.on('query-end', function (count) {
          console.log('Found', count, 'waypoints');
          scope.sly.reload();
          scope.done = true;
        });
        scope.showAddress = function () {
          var waypoint = scope.waypoints[this.$index];
          waypoint.show_address = true
          if (!waypoint.address) {
            socket.emit('get-address', {lat: waypoint.lat, long: waypoint.long});
          }
        }
        scope.setMarker = function () {
          var waypoint = scope.waypoints[this.$index];
          console.log(waypoint);
          scope.markers[waypoint.module_id] = {
            lat: waypoint.lat,
            lng: waypoint.long,
            message: waypoint.address
          }
        }
        
      }],
      transclude: false,
      template: 
      '<div>' + 
        '<div class="scrollbar">' +
          '<div class="handle">' +
	          '<div class="mousearea"></div>' +
          '</div>' +
        '</div>' +
        '<div class="frame">' +
          '<ul class="slidee">' +
            '<li id="{{$index}}" ng-repeat="item in waypoints" ng-click="showAddress()" ng-mouseover="setMarker()">' +
              '<div>' +
                '<span ng-show="item.show_address" style="padding-right: 1em">{{item.address}}</span>{{item.timestamp|date:"HH:mm:ss"}}'+
              '</div>' +
            '</li>' +
          '</ul>' +
        '</div>' +
      '</div>',
      link: function (scope, element, attrs) {
        scope.sly = new Sly($(element.find('.frame')), {
		      itemNav: 'forceCentered',
		      //smart: 1,
		      activateMiddle: 1,
		      activateOn: 'click',
		      mouseDragging: 1,
		      touchDragging: 1,
		      releaseSwing: 1,
		      startAt: 0,
		      scrollBar: element.find('.scrollbar'),
		      scrollBy: 1,
		      speed: 300,
		      elasticBounds: 1,
		      easing: 'easeOutExpo',
		      dragHandle: 1,
		      dynamicHandle: 1,
		      clickBar: 1,
	      }).init();
      }
    }
  })
