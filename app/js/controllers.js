'use strict';

/* Controllers */

angular.module('core.controllers', []).
  controller('testCtrl', ['$scope', function($scope, date) {
    var i;
    $scope.list = [];
    for (i = 10; i < 100; i += 1) {
  	  $scope.list.push({idx: i, name: ''});
  	}
  	$scope.date = 10;
  }])
