'use strict';

var app = angular.module('application', []);

app.controller('AppCtrl', function($scope, appFactory){
    $("#success_init").hide();
    $("#success_add_balance").hide();
    $("#success_queryall").hide();
    $("#success_exchange_balance").hide();

    $scope.initAB = function(){
        appFactory.initAB($scope.abstore, function(data){
            if(data == "Success") {
                $scope.init_ab = "success";
                $("#success_init").show();
            }
        });
    }

    $scope.add_balance = function(){
        appFactory.add_balance($scope.abstore, function(data){
            if(data == "Success") {
                $scope.add_balance_ab = "success";
                $("#success_add_balance").show();
            }
        });
    }

   $scope.queryAll = function(){
    appFactory.queryAll(function(data, error){
      if(data && !error) {
        // Make sure data is an array before using forEach
        let walletArray = data;
        if (!Array.isArray(walletArray)) {
          // If data is not an array, try to parse it or convert it to array
          try {
            if (typeof data === 'string') {
              walletArray = JSON.parse(data);
            } else if (data && typeof data === 'object') {
              // If it's an object with potential wallet properties
              walletArray = [data];
            } else {
              walletArray = [];
            }
          } catch (e) {
            console.error("Error parsing wallet data:", e);
            walletArray = [];
          }
        }
        
        // Now that we have an array, remove duplicates
        const uniqueWallets = [];
        const seenWalletNames = new Set();
        
        if (Array.isArray(walletArray)) {
          walletArray.forEach(wallet => {
            if (wallet && wallet.WalletName && !seenWalletNames.has(wallet.WalletName)) {
              uniqueWallets.push(wallet);
              seenWalletNames.add(wallet.WalletName);
            }
          });
        }
        
        $scope.query_all = uniqueWallets;
        $("#success_queryall").show();
        $("#error_queryall").hide();
        // Force Angular to update the view
        if(!$scope.$$phase) {
          $scope.$apply();
        }
      } else {
        $scope.error_queryall = error || "Failed to retrieve wallets.";
        $scope.query_all = [];
        $("#error_queryall").show();
        $("#success_queryall").hide();
        // Force Angular to update the view
        if(!$scope.$$phase) {
          $scope.$apply();
        }
      }
    });
  }

    $scope.exchange_balance = function(){
        appFactory.exchange_balance($scope.abstore, function(data){
            if(data == "Success") {
                $scope.exchange_balance_ab = "success";
                $("#success_exchange_balance").show();
            }
        });
    }
});

app.factory('appFactory', function($http){
    var factory = {};

    // 지갑 등록 (POST /init)
    factory.initAB = function(data, callback){
        $http.post('/init', {
            WalletName: data.WalletName,
            Username: data.Username,
            Password: data.Password
        }).then(function(response){
            callback("Success");
        }, function(error){
            callback("Error");
        });
    }

    // 잔액 추가 (GET /add_balance)
    factory.add_balance = function(data, callback){
        $http.get('/add_balance', {
            params: {
                WalletName: data.WalletName,
                amount: data.amount
            }
        }).then(function(response){
            callback("Success");
        }, function(error){
            callback("Error");
        });
    }

   // 모든 지갑 조회 (GET /queryall)
  factory.queryAll = function(callback){
    $http.get('/queryall').then(function(response){
      // Make sure we're passing the data array from the response
      if (response && response.data) {
        callback(response.data);
      } else {
        callback([]);
      }
    }, function(error){
      callback([], error.data && error.data.error || "Server error");
    });
  }

    // 지갑 간 잔액 교환 (POST /exchange_balance)
    factory.exchange_balance = function(data, callback){
        $http.post('/exchange_balance', {
            walletName1: data.walletName1,
            walletName2: data.walletName2,
            amount: data.amount
        }).then(function(response){
            callback("Success");
        }, function(error){
            callback("Error");
        });
    }

    return factory;
});