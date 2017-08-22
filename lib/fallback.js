///////////////////////////////////////////////////////////////////////////////
//
//  AutobahnJS - http://autobahn.ws, http://wamp.ws
//
//  A JavaScript library for WAMP ("The Web Application Messaging Protocol").
//
//  Copyright (C) 2011-2014 Tavendo GmbH, http://tavendo.com
//
//  Licensed under the MIT License.
//  http://www.opensource.org/licenses/mit-license.php
//
///////////////////////////////////////////////////////////////////////////////

var Autobahn = require('../autobahn.min.js');
var util = Autobahn.util;
var log = Autobahn.log;
var queryString = require('query-string');

var SESSIONID = '';
var _currentTransport = null;

function initializeFallback(self, transport) {
	console.log('websocket connection is down,connecting the fallback server.');
    _currentTransport = transport;
    var fallbackUrl = self._options.fallback;
	var sendUrl = `${fallbackUrl}/api/send?callback=JSONCALLBACK&sid=`;
	var messageUrl = `${fallbackUrl}/api/messages?jsoncallback=JSONCALLBACK&sid=`;
	var connectUrl = `${fallbackUrl}/api/connect?v=2&jsoncallback=JSONCALLBACK`;

	transport.send = function (msg) {
		send(sendUrl,msg);
	};

	transport.close = function (code, reason) {
		transport.onclose({ code: 1001, reason: '', wasClean: false });
		_currentTransport = null;
	};
	connect(connectUrl,messageUrl,transport);
    return transport;
};
function connect(url,messageUrl,transport){
    var sendConnect = function () {
        fetch(url)
        .then( (resp) => resp.text())
        .then( (text) => {
        	return parseJsonp(text)
        })
		.then((data) => {
			console.log('Successfully connected to the fallback server.');
			SESSIONID = data[1];
			transport.onopen();
			receive(messageUrl,transport);
		})
		.catch((error) => {
			console.log(`Failed to GET ${url} : ${error}`);
			setTimeout( sendConnect, 1000);
		});
    }
    sendConnect();
}

function send(baseUrl,message){
	var url = `${baseUrl}${SESSIONID}&`;
	fetch(url,{
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: queryString.stringify({message:JSON.stringify(message)})
	})
	.then((resp) => resp.text())
	.then((data) => {
	})
	.catch((error) => {
		console.log('send error:',error );
		// TO DO : Simulate error
	});
}

function receive(baseUrl, transport){
	if( _currentTransport !== transport )
		return;

	var url = `${baseUrl}${SESSIONID}`;

	fetch(url,{method: 'POST'})
	.then((resp) => resp.text())
	.then(function(text){
		return parseJsonp(text)
	})
	.then(function(json){
		if (json.success) {
            if (json.messages != null && typeof(json.messages) == typeof ([])) {
                for (var i = 0; i < json.messages.length; i++) {
                    transport.onmessage( JSON.parse(json.messages[i]) );
                }
            }
        }
        else {
            if (transport.onclose) {
                transport.onclose({ code: 1001, reason: '', wasClean: false });
            }
        }
        setTimeout( function(){ receive(baseUrl,transport); }, 0);
	})
	.catch((error) => {
        setTimeout( function(){ receive(baseUrl,transport); }, 0);
	});
}

function parseJsonp(data){
	if(data){
		var result = data.replace(/[\w\,]+\(/,'').replace(/\)\;/,'');
		result = JSON.parse(result);
		if(typeof result == 'string'){
			result = JSON.parse(result);
		}
	}else{
		result = {success:false,error:'no data received'};
	}
	var promise = new Promise((resolve,reject) => {
		if(result.success || result[0] == 0){
			resolve(result);
		}else{
			reject(result);
		}
	});

	return promise;
}



exports.initializeFallback = initializeFallback;
