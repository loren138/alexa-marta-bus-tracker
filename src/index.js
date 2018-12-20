"use strict";

var Alexa = require('alexa-sdk');
// Credit: jesal https://stackoverflow.com/a/14822579/3854385
String.prototype.replaceAll = function (find, replace) {
    var str = this;
    return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
};
// Credit: Steve Harrison https://stackoverflow.com/a/1026087/3854385
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
// Credit: Chris Barr https://stackoverflow.com/a/29234240/3854385
function formatArray(arr){
    var outStr = "";
    if (arr.length === 1) {
        outStr = arr[0];
    } else if (arr.length === 2) {
        //joins all with "and" but no commas
        //example: "bob and sam"
        outStr = arr.join(' and ');
    } else if (arr.length > 2) {
        //joins all with commas, but last one gets ", and" (oxford comma!)
        //example: "bob, joe, and sam"
        outStr = arr.slice(0, -1).join(', ') + ', and ' + arr.slice(-1);
    }
    return outStr;
}

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);

    alexa.appId = 'amzn1.ask.skill.87d11aa8-96e8-4365-979c-7e3e0f62104b';
    // alexa.dynamoDBTableName = 'YourTableName'; // creates new table for session.attributes

    alexa.registerHandlers(handlers);
    alexa.execute();
};
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
var busAdherence = function(time) {
    if (time === 0) {
        return 'on time';
    } else if (time === -1) {
        return '1 minute late';
    } else if (time === 1) {
        return '1 minute early';
    } else if (time < 0) {
        return Math.abs(time)+' minutes late';
    } else if (time > 0) {
        return time+' minutes early';
    }
    console.log(time);
};
var directionA = function(direction) {
    if (direction === 'eastbound') {
        return 'an eastbound';
    }  else {
        return 'a '+direction;
    }
};

var handlers = {
    'LaunchRequest': function () {
        this.emit(
            ":askWithCard",
            "Ask for the bus route and direction, such as where is route 125 southbound.",
            "Ask for the bus route and direction, such as where is route 125 southbound.",
            "MARTA Bus Tracker",
            "Ask for the bus route and direction, such as where is route 125 southbound."
        );
    },
    "AMAZON.StopIntent": function () {
        this.emit(":tell", "Good-bye");
    },
    "AMAZON.CancelIntent": function() {
        this.emit(":tell", "Good-bye");
    },
    "AMAZON.HelpIntent": function() {
        this.emit(
            ":askWithCard",
            "You can ask me for buses traveling a certain route and direction.  Ask me where is route 125 south or route 2 east.",
            "You can ask me for buses traveling a certain route and direction.  Ask me where is route 125 south or route 2 east.",
            "MARTA Bus Tracker",
            "You can ask me for buses traveling a certain route and direction.\nAsk me where is route 125 south or route 2 east."
        );
    },
    "Unhandled": function () {
        this.emit('LaunchRequest');
    },

    'FindBus': function () {
        var text3;
        if (!this.event.request.intent || !this.event.request.intent.slots || !this.event.request.intent.slots.busNumber ||
            !this.event.request.intent.slots.busNumber.value) {
            text3 = 'I didn\'t get a bus route, please try something like where is route 125 southbound.';
            this.emit(':askWithCard', text3, text3, 'MARTA Bus Tracker', text3);
            return;
        }
        var route = this.event.request.intent.slots.busNumber.value;
        if (!isNumeric(route)) {
            text3 = 'The route must be a number, please try again.';
            this.emit(':askWithCard', text3, text3, 'MARTA Bus Tracker', text3);
            return;
        }
        if (!this.event.request.intent.slots.busDirection ||
            !this.event.request.intent.slots.busDirection.value) {
            text3 = 'I didn\'t get a bus direction, please try something like where is route '+route+' southbound.';
            this.emit(':askWithCard', text3, text3, 'MARTA Bus Tracker', text3);
            return;
        }
        var direction = this.event.request.intent.slots.busDirection.value.toLowerCase();
        // Direction fixing since amazon doesn't do it for us
        if (direction === 'e' || direction === 'east') {
            direction = 'eastbound';
        } else if (direction === 'w' || direction === 'west') {
            direction = 'westbound';
        } else if (direction === 'n' || direction === 'north') {
            direction = 'northbound';
        } else if (direction === 's' || direction === 'south') {
            direction = 'southbound';
        }
        httpGet(route, direction,  (results) => {
                console.log(results);
                var title = 'Route '+route+' '+capitalizeFirstLetter(direction);
                var myResult = results[1];
                var count = myResult.length;
                var tell = '';
                var card = '';
                if (count === 0) {
                    if (results[0].length > 0) {
                        var directions = results[0];
                        var text;
                        if (directions.length === 1) {
                            text = 'I could not find any '+direction+' buses for route '+route+'.  I did find '+directionA(directions[0])+' bus.  You can try again with that direction.';

                        } else if (directions.length === 2) {
                            text = 'I could not find any '+direction+' buses for route '+route+'.  I did find '+directionA(directions[0])+' and '+directionA(directions[1])+' bus. '+
                                'You can try again with one of those directions.';
                        } else {
                            // Buses should not be going more than 2 ways...
                            text = 'I could not find any '+direction+' buses for route '+route+'.  I did find buses going '+formatArray(directions)+'. '+
                                'You can try again with one of those directions.';
                        }
                        this.emit(':askWithCard', text, text, title, text);
                        return;
                    }
                    var text2 = 'I could not find any buses for route '+route+'.  Please check your route number.  '+
                        'Alternatively, It might be outside of operating hours or MARTA may be having problems with their data.';
                    this.emit(':tellWithCard', text2, title, text2);
                    return;
                } else if (count === 1) {
                    tell = 'I found 1 '+direction+' bus. ';
                } else {
                    tell = 'I found '+count+' '+direction+' buses. ';
                }

                for (var i = 0; i < myResult.length; i++) {
                    var bus = myResult[i];
                    tell += 'A bus near '+bus[0]+' is '+busAdherence(bus[1])+'. ';
                    card += 'A bus near '+bus[0]+' is '+busAdherence(bus[1])+'.\n';
                }

                var replacements = [
                    ['&', 'and'],
                    ['E.', 'East '],
                    ['W.', 'West '],
                    ['N.', 'North '],
                    ['S.', 'South '],
                    ['Ctnr.', 'Center '],
                    ['  ', ' '] // Clear out an double spaces we caused in the find/replace
                ];

                // Replacements
                for (var i = 0; i < replacements.length; i++) {
                    tell = tell.replaceAll(replacements[i][0], replacements[i][1]);
                    card = card.replaceAll(replacements[i][0], replacements[i][1]);
                }

                this.emit(':tellWithCard', tell, title, card);

            }
        );

    }
};


//    END of Intent Handlers {} ========================================================================================
// 3. Helper Function  =================================================================================================


var http = require('http');
// https is a default part of Node.JS.  Read the developer doc:  https://nodejs.org/api/https.html
// try other APIs such as the current bitcoin price : https://btc-e.com/api/2/btc_usd/ticker  returns ticker.last

function httpGet(route, direction, callback) {

    direction = direction.toLowerCase();

    //http://developer.itsmarta.com/BRDRestService/RestBusRealTimeService/GetBusByRoute/120
    var options = {
        host: 'developer.itsmarta.com',
        port: 80,
        path: '/BRDRestService/RestBusRealTimeService/GetBusByRoute/'+route,
        method: 'GET'

        // if x509 certs are required:
        // key: fs.readFileSync('certs/my-key.pem'),
        // cert: fs.readFileSync('certs/my-cert.pem')
    };

    var req = http.request(options, res => {
        res.setEncoding('utf8');
        var returnData = "";

        res.on('data', chunk => {
                returnData = returnData + chunk;
        });

        res.on('end', () => {
            // we have now received the raw return data in the returnData variable.
            // We can see it in the log output via:
            // console.log(JSON.stringify(returnData))
            // we may need to parse through it to extract the needed data

            var result;

            try {
                result = JSON.parse(returnData);
                console.log(result);
            } catch (e) {
                console.error(e);
                console.log(returnData);
                callback([[],[]]);
                return;
            }
            var apply = [];
            var directions = [];
            for (var i = 0; i < result.length; i++) {
                var bus = result[i];
                var busDirection = bus.DIRECTION;
                if (typeof busDirection === 'string') {
                    busDirection = busDirection.toLowerCase();
                    if (directions.indexOf(busDirection) === -1) {
                        directions.push(busDirection);
                    }
                    if (busDirection === direction) {
                        var adherence = bus.ADHERENCE;
                        if (typeof  adherence === 'string') {
                            adherence = parseInt(adherence, 10);
                        }
                        apply.push([bus.TIMEPOINT, adherence]);
                    }
                }
            }

            callback([directions,apply]);  // this will execute whatever function the caller defined, with one argument

        });

    });
    req.end();

}