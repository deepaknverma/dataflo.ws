// usage:
/*
	<script src="require-browser.js"></script> <!-- sync loading -->
	<script>
		preloadAssets ();
	</script>
*/

var _required = {

};

require.register ('util.js', function () {
	var util = {};
	util.inherits = function (ctor, superCtor) {
		ctor.super_ = superCtor;
		ctor.prototype = Object.create (superCtor.prototype, {
			constructor: {
			value: ctor,
			enumerable: false,
			writable: true,
			configurable: true
		}});
	};

	util.class2type = {};

	"Boolean Number String Function Array Date RegExp Object Error".split(" ").forEach (function(name, i) {
		util.class2type[ "[object " + name + "]" ] = name.toLowerCase();
	});

	util.isPlainObject = function isPlainObject (obj) {

		var isObject = typeof obj === "object" || typeof obj === "function" ? util.class2type[{}.toString.call(obj)] || "object" : typeof obj;
		if (isObject !== "object" || obj.nodeType || obj === obj.window) {
			return false;
		}

		// Support: Firefox <20
		// The try/catch suppresses exceptions thrown when attempting to access
		// the "constructor" property of certain host objects, ie. |window.location|
		// https://bugzilla.mozilla.org/show_bug.cgi?id=814622
		try {
			if (obj.constructor &&
					!{}.hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf")) {
				return false;
			}
		} catch (e) {
			return false;
		}

		// If the function hasn't returned already, we're confident that
		// |obj| is a plain object, created by {} or constructed with new Object
		return true;
	};

	util.extend = function extend () {
		// copy reference to target object
		var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;
		// Handle a deep copy situation
		if (typeof target === "boolean") {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		}
		// Handle case when target is a string or something (possible in deep copy)
		if (typeof target !== "object" && !typeof target === 'function')
			target = {};
		for (; i < length; i++) {
			// Only deal with non-null/undefined values
			if ((options = arguments[i]) !== null) {
				// Extend the base object
				for (name in options) {
					src = target[name];
					copy = options[name];
					// Prevent never-ending loop
					if (target === copy)
						continue;
					// Recurse if we're merging object literal values or arrays
					if (deep && copy && (util.isPlainObject(copy) || Array.isArray(copy))) {
						var clone = src && (util.isPlainObject(src) || Array.isArray(src)) ? src : Array.isArray(copy) ? [] : {};
						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);
						// Don't bring in undefined values
					} else if (typeof copy !== "undefined")
						target[name] = copy;
				}
			}
		}
		// Return the modified object
		return target;
	}
	return {exports: util};
});

require.alias("util.js", "apla-dataflo.ws/deps/util.js");
require.alias("util.js", "elmobro/deps/util.js");

require.alias("apla-dataflo.ws/common.js", "common.js");

var events = require ('events');
events.EventEmitter = events;

var eventsPath = require.resolve ('events');

require.alias(eventsPath, "apla-dataflo.ws/deps/events.js");
require.alias(eventsPath, "elmobro/deps/events.js");


util = {};

module = {
	exports: {}
};
