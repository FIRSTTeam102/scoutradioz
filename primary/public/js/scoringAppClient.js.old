'use strict';
/*--------------------------------------------------------------------
 **	File Name: scoringAppClient.js
 **
 **  Description:  web client for the scoring App.
 **
 **  Author:  
 **
 **  Creation Date: 2/2/2018
 **
 ** 
 **--------------------------------------------------------------------
 */

 // Angular wants to see an app and a controller.  The app defines the scope of our application in the html.
 // The controller does the work
 
var scoringAppClient =angular.module('scoringAppClientApp', ['btford.socket-io', 'mobile-angular-ui', 'mobile-angular-ui.gestures'])

scoringAppClient.controller('scoringAppClientCtrl', ['$scope', '$timeout', '$http', 'serverSocket', function($scope, $timeout, $http, serverSocket){
		
	$scope.teamInfo =[];
	$scope.membersPresent =[];
	
	$scope.backendInfo ={};

	$scope.handleGhButtonPress =function(ghIndex){
		if( $scope.membersPresent[ghIndex].isSelected === false ){
			$scope.membersPresent[ghIndex].isSelected =true;
		}
		else{
			$scope.membersPresent[ghIndex].isSelected =false;
		}
		
		console.log("Button Press Handler item " + ghIndex);
	};
	
	$scope.handleCommitButtonPress =function(assignmentNumber){
		var assignmentMsg={
			msgId:0,
			to:"server",
			from:"client",
			data:[]
		};

		$scope.membersPresent.forEach(function(member){
			if(member.isSelected){
				member.isSelected =false;
				member.groupAssignment =assignmentNumber;
				
				assignmentMsg.data.push(member)
			}
		});
		
		console.log("Commit member assignments.");
		serverSocket.emit('set-assignments',assignmentMsg)
	};

	angular.element(document).ready(function (){
	
	});
	
	serverSocket.on('connect', function (data) {
		console.log("Connected to server.");
		// Maybe we want to sync up with the backend here?  If yes, then we need to define a message
		// that will be handled by the backend. i.e. serverSocket.emit('sync-me',{data to send here});
		
	});
	
	serverSocket.on('disconnect', function(data){
		console.log("Disconnected from server.");
	});

	serverSocket.on('i-am-alive',function(iAmAliveMsg){
		console.log("Server is Alive and has some cool data..." + JSON.stringify(iAmAliveMsg));
		
		$scope.backendInfo =iAmAliveMsg.data.serverInfo;
		$scope.teamInfo =iAmAliveMsg.data.teamInfo;
		
		// Clear the array.
		$scope.membersPresent.length =0;
		
		iAmAliveMsg.data.teamInfo.forEach ( function(member){
			if( member.isPresent){
				member.isSelected =false;
				$scope.membersPresent.push(member);
			}	
		});
	});
	
	serverSocket.on('get-all-present-reply',function(allPresentMsg){
		console.log("Get all present reply" + JSON.stringify(allPresentMsg));

		$scope.membersPresent =allPresentMsg;	
	});
}]);

scoringAppClient.factory('serverSocket', function (socketFactory) {
    var ioSocket = io.connect('', {
        'auto connect'              : true,
        'connect timeout'           : 5000,
        'flash policy port'         : 10843,
        'force new connection'      : true,
        'max reconnection attempts' : 10,
        'multiplex'                 : false,
        'reconnect'                 : false,
        'reconnection delay'        : 500,
        'reconnection limit'        : Infinity,
        'resource'                  : 'socket.io',
        'sync disconnect on unload' : true,
        'try multiple transports'   : true
    });

    var serverSocket = socketFactory({ioSocket: ioSocket});
    console.log("Socket created to server.");
    return serverSocket;
});

scoringAppClient.directive("ngMobileClick", [function () {
    return function (scope, elem, attrs) {
        elem.bind("touchstart click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            scope.$apply(attrs["ngMobileClick"]);
        });
    }
}])
