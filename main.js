var url = require("url");
var http = require("http");

var _ = require("lodash");
var async = require("async");
var prompt = require("prompt");
var imageToAscii = require("image-to-ascii");
var colors = require('colors');

prompt.delimiter = " ";
prompt.start();

var getSessionOptions = url.parse("http://www.duolingo.com/sessions/?type=global_practice");
getSessionOptions.method = "GET";

var postAnswerOptions = url.parse("http://www.duolingo.com/session_element_solutions/lesson/translate");
postAnswerOptions.method = "POST";

console.log("Please open your web browser to the Duolingo page, select the language you want and copy the auth_tkt cookie here:");
prompt.message = "Cookie".inverse;
prompt.get({description: "auth_tkt".white}, function(err, res) {

	getSessionOptions.headers = {
		Cookie: "auth_tkt=\"" + res.question + "!userid_type:int\""
	}
	postAnswerOptions.headers = {
		Cookie: "auth_tkt=\"" + res.question + "!userid_type:int\""
	}

	http.get(getSessionOptions, function(res) {
		var data = "";

		// TOOD: Check that JSON is returned
		res.on("data", function(chunk) {
			data += chunk;
		});

		res.on("end", function() {
			var duoData = JSON.parse(data);
			duoTest(duoData);
		});
	});
});

function duoTest(data) {
	console.log("Initiating Duolingo " + data.language_string);

	async.eachSeries(data.session_elements, function(elem, callback) {

		console.log(); // Newline before each question

		switch (elem.type) {
			case "translate":
				translate(elem, callback);
				// callback();
				break;
			case "judge":
				// judge(elem, callback);
				callback();
				break;
			case "name":
				// name(elem, callback);
				callback();
				break;
			default:
				console.log("Unknown type: " + elem.type);
				break;
		}
	}, function(err) {
		if (err) {
			console.error(err);
		} else {
			console.log("Question flow complete");
		}
	});
}

function translate(element, callback) {

	prompt.message = "Translate".inverse;
	var schema = {
		description: element.sentence.white,
		required: true,
		type: "string"
	}

	var startTime = new Date();


	prompt.get(schema, function(err, res) {
		var endTime = new Date();
		
		var data = {
			type: "translate",
			session_element: element,
			solution_key: element.solution_key,
			time_taken: endTime - startTime
		}

		if (err) {
			console.error(err);
			data.value = "";
			data.skipped = true;
		} else {
			data.value = res.question;
			data.skipped = false;
		}

		
		var req = http.request(postAnswerOptions, function(res) {
			var data = "";
			res.on("data", function(chunk) {
				data += chunk;
			});

			res.on("end", function() {
				var resData = JSON.parse(data);
				if (resData.incorrect) {
					console.log("Incorrect!".red);
					console.log("Closest Translation: " + resData.closest_translation);

				} else {
					console.log("Correct!".green);
				}

				callback();
			});
		});

		req.on("error", function(err) {
			callback(err);
		})

		req.write(JSON.stringify(data));
		req.end();
	});
}

function judge(element, callback) {

	// TODO: Change query to select with cursor instead of typing
	var text = element.text + "\n";

	_.each(element.sentences, function(sentence, index) {
		text += (index+1) + ": " + sentence.sentence + "\n";
	}, this);

	prompt.message = "Judge".inverse;
	var schema = {
		description: text.white,
		required: true
	}

	prompt.get(schema, function(err, res) {
		var endTime = new Date();

		if (err) {
			console.error(err);
		}
		
		var data = {
			type: "judge",
			session_element: element,
			choices: res.question,
			solution_key: element.solution_key,
			skipped: false,
			time_taken: endTime - startTime
		}
		
		var req = http.request(postAnswerOptions, function(res) {
			var data = "";
			res.on("data", function(chunk) {
				data += chunk;
			});

			res.on("end", function() {
				var resData = JSON.parse(data);

				console.log(resData);
				// if (resData.incorrect) {
				// 	console.log("Incorrect!".red);
				// 	console.log("Closest Translation: " + resData.closest_translation);

				// } else {
				// 	console.log("Correct!".green);
				// }

				callback();
			});
		});

		req.on("error", function(err) {
			callback(err);
		})

		req.write(JSON.stringify(data));
		req.end();

	})
}

function name(element, callback) {

	var width = process.stdout.columns;

	async.map(
		element.images, 
		
		function loadImage(image, imageCallback) {
			imageToAscii(image, imageCallback);
		}, 

		function(err, res) {
			debugger;
			if (err) {
				console.error(err);
			}

			_.each(res, function(image){
				console.log(image);
			});

			prompt.message = "Name".inverse;
			var schema = {
				description: element.hint.white,
				required: true,
				type: "string",
				pattern: /(der|die|das)\s[a-z]+/i // Hardcoded article for german nouns
			}

			prompt.get(schema, function(err, res) {
				if (err) {
					console.error(err);
				}
				callback();
			});
		}
	);
}
