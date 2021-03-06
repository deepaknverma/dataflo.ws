var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	dataflows    = require ('./index'),
	common       = dataflows.common,
	taskClass    = require ('./task/base'),
	paint        = dataflows.color,
	tokenInitiator;

var $global = common.$global;

var taskStateNames = taskClass.prototype.stateNames;

function isVoid(val) {
	return void 0 == val;
}

function taskRequirements (requirements, dict) {

	var result = [];

	for (var k in requirements) {
		var requirement = requirements[k];
		for (var i = 0; i < requirement.length; i++) {
			try {
				if (isVoid (common.pathToVal (dict, requirement[i])))
					result.push (k);
			} catch (e) {
				result.push (k);
			}
		}
	}

	return result;
}

function checkTaskParams (params, dict, prefix, marks) {
	// parse task params
	// TODO: modify this function because recursive changes of parameters works dirty (indexOf for value)

	var AllowedValueTypes = {
		Boolean: true,
		Number: true,
		Function: true,
		Date: true
	};

	if (prefix == void 0) prefix = '';
	if (prefix) prefix += '.';

	var modifiedParams;
	var failedParams = [];

	if (Object.is('Array', params)) { // params is array

		modifiedParams = [];

		params.forEach(function (val, index, arr) {
			if (Object.is('String', val)) { // string

				try {
					var tmp = val.interpolate(dict, marks);
					if (tmp === undefined) {
						failedParams.push (prefix+'['+index+']');
					} else {
						modifiedParams.push(tmp);
					}
				} catch (e) {
					failedParams.push (prefix+'['+index+']');
				}

			} else if (Object.typeOf(val) in AllowedValueTypes) {
				modifiedParams.push(val);
			} else {
				var result = checkTaskParams(
					val, dict, prefix+'['+index+']', marks
				);

				modifiedParams.push(result.modified);
				failedParams = failedParams.concat (result.failed);
			}
		});

	} else { // params is hash
		modifiedParams = {};

		Object.keys(params).forEach(function (key) {
			var val = params[key];
			var valCheck = val;

			if (Object.is('String', val)) {
				try {
					var tmp = val.interpolate(dict, marks);
					if (tmp === undefined) {
						failedParams.push (prefix+key);
					} else {
						modifiedParams[key] = tmp;
					}
				} catch (e) {
					//console.error('ERR!');
					failedParams.push (prefix+key);
				}
			} else if (Object.typeOf(val) in AllowedValueTypes) {
				modifiedParams[key] = val;
			} else { // val is hash || array
				var result = checkTaskParams(val, dict, prefix+key, marks);

				modifiedParams[key] = result.modified;
				failedParams = failedParams.concat (result.failed);
			}
		});
	}

	return {
		modified: modifiedParams,
		failed: failedParams || []
	};
}

/**
 * @class flow
 * @extends events.EventEmitter
 *
 * The heart of the framework. Parses task configurations, loads dependencies,
 * launches tasks, stores their result. When all tasks are completed,
 * notifies subscribers (inititators).
 *
 * @cfg {Object} config (required) dataflow configuration.
 * @cfg {String} config.$class (required) Class to instantiate
 * (alias of config.className).
 * @cfg {String} config.$function (required) Synchronous function to be run
 * (instead of a class). Alias of functionName.
 * @cfg {String} config.$set Path to the property in which the produced data
 * will be stored.
 * @cfg {String} config.$method Method to be run after the class instantiation.
 * @cfg {Object} reqParam (required) dataflow parameters.
 */
var dataflow = module.exports = function (config, reqParam) {

	var self = this;

	// TODO: copy only required things
	util.extend (true, this, config); // this is immutable config skeleton
	util.extend (true, this, reqParam); // this is config fixup

	this.created = new Date().getTime();

	// here we make sure dataflow uid generated
	// TODO: check for cpu load
	var salt = (Math.random () * 1e6).toFixed(0);
	this.id      = this.id || (this.started ^ salt) % 1e6;
	if (!this.idPrefix) this.idPrefix = '';

	if (!this.stage) this.stage = 'dataflow';

	//if (!this.stageMarkers[this.stage])
	//	console.error ('there is no such stage marker: ' + this.stage);

	var idString = ""+this.id;
	while (idString.length < 6) {idString = '0' + idString};
	this.coloredId = [
		"" + idString[0] + idString[1],
		"" + idString[2] + idString[3],
		"" + idString[4] + idString[5]
	].map (function (item) {
		if ($isServerSide) return "\x1B[0;3" + (parseInt(item) % 8)  + "m" + item + "\x1B[0m";
		return item;
	}).join ('');

	this.data = this.data || { data: {} };

//	console.log ('!!!!!!!!!!!!!!!!!!!' + this.data.keys.length);

//	console.log ('config, reqParam', config, reqParam);

	self.ready = true;

	var tasks = config.tasks;

	// TODO: optimize usage - find placeholders and check only placeholders
	if (config.tasksFrom) {
		if (!tokenInitiator) tokenInitiator = require ('initiator/token');

		var flowByToken;

		if (
			!project.config.initiator
			|| !project.config.initiator.token
			|| !project.config.initiator.token.flows
			|| !(flowByToken = project.config.initiator.token.flows[config.tasksFrom])
			|| !flowByToken.tasks
		) {
			this.log ('"tasksFrom" parameter requires to have "initiator/token/flows'+config.tasksFrom+'" configuration in project');
			this.ready = false;
		}

		tasks = flowByToken.tasks;
	} else if (!config.tasks || !config.tasks.length) {
		config.tasks = [];
	}

	function createDict () {
		// TODO: very bad idea: reqParam overwrites flow.data
		var dict = util.extend (true, self.data, reqParam);
		dict.global  = $global;
		dict.appMain = $mainModule.exports;

		if ($isServerSide) {
			try { dict.project = project; } catch (e) {}
		}

		return dict;
	}

	var taskGen = function (type, actualTaskParams) {
		if (type === 'createDict') return createDict;
		if (type === 'checkRequirements') return function () {
			var dict = createDict ();

			var result = checkTaskParams (actualTaskParams, dict, self.marks);

			if (result.failed && result.failed.length > 0) {
				this.unsatisfiedRequirements = result.failed;
				return false;
			} else if (result.modified) {
				// TODO: bad
				util.extend (this, result.modified);
				return true;
			}
		}
	}


	this.tasks = tasks.map (taskClass.prepare.bind (taskClass, self, dataflows, taskGen));

};

util.inherits (dataflow, EventEmitter);

function pad(n) {
	return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

// one second low resolution timer
Date.dataflowsLowRes = new Date ();
Date.dataflowsLowResInterval = setInterval (function () {
	Date.dataflowsLowRes = new Date ();
}, 1000);

function timestamp () {
	var lowRes = Date.dataflowsLowRes;
	var time = [
		pad(lowRes.getHours()),
		pad(lowRes.getMinutes()),
		pad(lowRes.getSeconds())
	].join(':');
	var date = [
		lowRes.getFullYear(),
		pad(lowRes.getMonth() + 1),
		pad(lowRes.getDate())
	].join ('-');
	return [date, time].join(' ');
}


util.extend (dataflow.prototype, {
	checkTaskParams: checkTaskParams,
	taskRequirements: taskRequirements,
	failed: false,
	isIdle: true,
	haveCompletedTasks: false,

	/**
	 * @method run Initiators call this method to launch the dataflow.
	 */
	runDelayed: function () {
		var self = this;
		if ($isClientSide) {
			setTimeout (function () {self.run ();}, 0);
		} else if ($isServerSide) {
			process.nextTick (function () {self.run ()});
		}
	},

	run: function () {
		if (!this.started)
			this.started = new Date().getTime();

		var self = this;

		if (self.stopped)
			return;
		/* @behrad following was overriding already set failed status by failed tasks */
//		self.failed = false;
		self.isIdle = false;
		self.haveCompletedTasks = false;

//		self.log ('dataflow run');

		this.taskStates = [0, 0, 0, 0, 0, 0, 0];

		// check task states

		if (!this.tasks) {
			self.emit ('failed', self);
			self.logError (this.stage + ' failed immediately due empty task list');
			self.isIdle = true;
			return;
		}

		if (!this.ready) {
			self.emit ('failed', self);
			self.logError (this.stage + ' failed immediately due unready state');
			self.isIdle = true;
			return;
		}

		this.tasks.forEach (function (task, idx) {

			if (task.subscribed === void(0)) {
				self.addEventListenersToTask (task);
			}

			task.checkState ();

			self.taskStates[task.state]++;

//			console.log ('task.className, task.state\n', task, task.state, task.isReady ());

			if (task.isReady ()) {
				self.logTask (task, 'started');
				try {
					task._launch ();
				} catch (e) {
					task.failed (e);
					// self.logTaskError (task, 'failed to run', e);
				}

				// sync task support
				if (!task.isReady()) {
					self.taskStates[task.stateNames.ready]--;
					self.taskStates[task.state]++;
				}
			}
		});

		var taskStateNames = taskClass.prototype.stateNames;

		if (this.taskStates[taskStateNames.ready] || this.taskStates[taskStateNames.running]) {
			// it is save to continue, wait for running/ready task
			// console.log ('have running tasks');

			self.isIdle = true;

			return;
		} else if (self.haveCompletedTasks) {
			// console.log ('have completed tasks');
			// stack will be happy
			self.runDelayed();

			self.isIdle = true;

			return;
		}

		self.stopped = new Date().getTime();

		var scarceTaskMessage = 'unsatisfied requirements: ';

		// TODO: display scarce tasks unsatisfied requirements
		if (this.taskStates[taskStateNames.scarce]) {
			self.tasks.map (function (task, idx) {
				if (task.state != taskStateNames.scarce && task.state != taskStateNames.skipped)
					return;
				if (task.important) {
					task.failed (idx + " important task didn't start");
					self.taskStates[taskStateNames.scarce]--;
					self.taskStates[task.state]++;
					self.failed = true;
					scarceTaskMessage += '(important) ';
				}

				if (task.state == taskStateNames.scarce || task.state == taskStateNames.failed)
					scarceTaskMessage += idx + ' ' + (task.logTitle) + ' => ' + task.unsatisfiedRequirements.join (', ') + '; ';
			});
			self.log (scarceTaskMessage);
		}

		if (self.verbose) {
			var requestDump = '???';
			try {
				requestDump = JSON.stringify (self.request)
			} catch (e) {
				if ((""+e).match (/circular/))
					requestDump = 'CIRCULAR'
				else
					requestDump = e
			};
		}

		if (this.failed) {
			// dataflow stopped and failed

			self.emit ('failed', self);
			var failedtasksCount = this.taskStates[taskStateNames.failed]
			self.logError (this.stage + ' failed in ' + (self.stopped - self.started) + 'ms; failed ' + failedtasksCount + ' ' + (failedtasksCount == 1 ? 'task': 'tasks') +' out of ' + self.tasks.length);

		} else {
			// dataflow stopped and not failed

			self.emit ('completed', self);
			self.log (this.stage + ' complete in ' + (self.stopped - self.started) + 'ms');
		}

		self.isIdle = true;

	},
	stageMarker: {prepare: "[]", dataflow: "()", presentation: "{}"},
	_log: function (level, msg) {
//		if (this.quiet || process.quiet) return;
		var toLog = [].slice.call (arguments);
		var level = toLog.shift() || 'log';
		toLog.unshift (
			timestamp (),
			this.stageMarker[this.stage][0] + this.idPrefix + this.coloredId + this.stageMarker[this.stage][1]
		);

		// TODO: also check for bad clients (like ie9)
		if ($isPhoneGap) {
			toLog.shift();
			toLog = [toLog.join (' ')];
		}

		console[level].apply (console, toLog);
	},
	log: function () {
		var args = [].slice.call (arguments);
		args.unshift ('log');
		this._log.apply (this, args);
	},
	logTask: function (task, msg) {
		this._log ('log', task.dfTaskLogNum, task.logTitle,  "("+task.state+")",  msg);
	},
	logTaskError: function (task, msg, options) {
		var lastFrame = '';
		if (options && options.stack) {
			var frames = options.stack.split('\n');
			var len = frames.length;
			if (frames.length > 1) {
				lastFrame = frames[1].trim();
			}
		}

		this._log (
			'error',
			task.dfTaskLogNum,
			task.logTitle,
			'(' + task.state + ') ',
			paint.error (
				util.inspect (msg).replace (/(^'|'$)/g, "").replace (/\\'/, "'"),
				util.inspect (options || '').replace (/(^'|'$)/g, "").replace (/\\'/, "'")
			),
			lastFrame
		);
	},
	logError: function (msg, options) {
		// TODO: fix by using console.error
		this._log ('error', paint.error (
			util.inspect (msg).replace (/(^'|'$)/g, "").replace (/\\'/, "'"),
			util.inspect (options || '').replace (/(^'|'$)/g, "").replace (/\\'/, "'")
		));
	},
	addEventListenersToTask: function (task) {
		var self = this;

		task.subscribed = 1;

		// loggers
		task.on ('log', function (message) {
			self.logTask (task, message);
		});

		task.on ('warn', function (message) {
			self.logTaskError (task, message);
		});

		task.on ('error', function (e) {
			self.error = e;
			self.logTaskError (task, 'error: ', e);
		});

		// states
		task.on ('skip', function () {
//			if (task.important) {
//				self.failed = true;
//				return self.logTaskError (task, 'error ' + arguments[0]);
//			}
			self.logTask (task, 'task skipped');

			if (self.isIdle)
				self.runDelayed ();

		});

		task.on ('cancel', function (failedValue) {

			if (task.retries !== null)
				self.logTaskError (task, 'canceled, retries = ' + task.retries);

			if (!task.retries && task.$setOnFail) {
				common.pathToVal(self.data, task.$setOnFail, failedValue || true);
				self.haveCompletedTasks = true;
			} else {
				self.failed = true;
			}

			if (self.isIdle)
				self.runDelayed ();
		});

		task.on ('complete', function (t, result) {

			if (result) {
				if (t.produce || t.$set) {
					common.pathToVal (self.data, t.produce || t.$set, result);
				} else if (t.$mergeWith) {
					common.pathToVal (self.data, t.$mergeWith, result, common.mergeObjects);
				}
			}

			self.logTask (task, 'task completed');

			if (self.isIdle) {
				self.runDelayed ();
			} else
				self.haveCompletedTasks = true;
		});

		task.on('empty', function (t) {
			if (t.$empty || t.$setOnEmpty) {
				common.pathToVal(self.data, t.$empty || t.$setOnEmpty, true);
			}
		});

	}
});

// legacy
dataflow.isEmpty = common.isEmpty;
