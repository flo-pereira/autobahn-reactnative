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
var fallback = require('./fallback.js');

function Factory (options) {
   var self = this;

   util.assert(options.url !== undefined, "options.url missing");
   util.assert(typeof options.url === "string", "options.url must be a string");

   if (!options.protocols) {
      options.protocols = ['wamp.2.json'];
   } else {
      util.assert(Array.isArray(options.protocols), "options.protocols must be an array");
   }

   self._options = options;
}


Factory.prototype.type = "mobile";


Factory.prototype.create = function () {

   var self = this;
   // the WAMP transport we create
   var transport = {};
   transport.options = self._options;
   var websocket = null;

   // these will get defined further below
   transport.protocol = undefined;
   transport.send = undefined;
   transport.close = undefined;

   // these will get overridden by the WAMP session using this transport
   transport.onmessage = function () {};
   transport.onopen = function () {};
   transport.onclose = function () {};

   transport.info = {
      type: 'websocket',
      url: null,
      protocol: 'wamp.2.json'
   };

   var timer = setTimeout(function(){
      if(websocket){
         websocket.close();
      }

      if (transport.options.fallback) {
        fallback.initializeFallback(self, transport);
      }
   },6000);
      
   // Test below used to be via the 'window' object in the browser.
   // This fails when running in a Web worker.
   // 
   // running in Node.js
   // 
   if (global.process) {

      (function () {
         var protocols;
         websocket = new WebSocket(self._options.url);
         websocket._opened = false;

         transport.send = function (msg) {
            var payload = JSON.stringify(msg);
            websocket.send(payload);
         };

         transport.close = function (code, reason) {
            websocket.close();
         };

         websocket.onopen = () => {
            console.log('Successfully connected to the websocket server.');
            websocket._opened = true;
            transport.onopen();
            clearTimeout(timer);
         };

         websocket.onmessage = (evt, flags) => {
            if (flags && flags.binary) {
               // FIXME!
            } else {
               var msg = JSON.parse(evt.data);
               transport.onmessage(msg);
               errorCount = 0;
            }
         };

         websocket.onclose = (code, message) => {
            console.log(`websocket connection closed, reason: ${message}`);
            if( websocket._opened ){
               var details = {
                  code: code,
                  reason: message,
                  wasClean: code === 1000
               }
               transport.onclose(details);
            }
         };

         websocket.onerror = (error) => {
            if( websocket._opened ){
               var details = {
                  code: 1006,
                  reason: '',
                  wasClean: false
               }
               transport.onclose(details);
            }
         };

      })();
   
   }

   return transport;
};



exports.Factory = Factory;
