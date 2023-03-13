//! © 2015 Nathan Rugg <nmrugg@gmail.com> | MIT
/// See LICENSE for more details.

// jshint bitwise:true, curly:true, eqeqeq:true, forin:true, immed:true, latedef:true, newcap:true, noarg:true, noempty:true, nonew:true, onevar:true, plusplus:true, quotmark:double, undef:true, unused:strict, browser: true, node: true

export default function LZMA (lzma_path: string) {
	var action_compress   = 1,
		action_decompress = 2,
		action_progress   = 3,
		
		callback_obj = {},
		
		///NOTE: Node.js needs something like "./" or "../" at the beginning.
		lzma_worker = new Worker(lzma_path || "./lzma_worker-min.js");
	
	console.log('created worker', lzma_worker)
	
	lzma_worker.onmessage = function onmessage(e) {
		if (e.data.action === action_progress) {
			// @ts-ignore
			if (callback_obj[e.data.cbn] && typeof callback_obj[e.data.cbn].on_progress === "function") {
				// @ts-ignore
				callback_obj[e.data.cbn].on_progress(e.data.result);
			}
		} else {
			// @ts-ignore
			if (callback_obj[e.data.cbn] && typeof callback_obj[e.data.cbn].on_finish === "function") {
				// @ts-ignore
				callback_obj[e.data.cbn].on_finish(e.data.result, e.data.error);
				
				/// Since the (de)compression is complete, the callbacks are no longer needed.
			// @ts-ignore
				delete callback_obj[e.data.cbn];
			}
		}
	};
	
	/// Very simple error handling.
	lzma_worker.onerror = function(event) {
		var err = new Error(event.message + " (" + event.filename + ":" + event.lineno + ")");
		
		for (var cbn in callback_obj) {
			// @ts-ignore
			callback_obj[cbn].on_finish(null, err);
		}
		
		console.error('Uncaught error in lzma_worker', err);
	};
	
	return (function () {
		
			// @ts-ignore
		function send_to_worker(action, data, mode, on_finish, on_progress) {
			var cbn;
			do {
				cbn = Math.floor(Math.random() * (10000000));
				// @ts-ignore
			} while(typeof callback_obj[cbn] !== "undefined");
			// @ts-ignore
			callback_obj[cbn] = {
				on_finish:   on_finish,
				on_progress: on_progress
			};
			
			lzma_worker.postMessage({
				action: action, /// action_compress = 1, action_decompress = 2, action_progress = 3
				cbn:    cbn,    /// callback number
				data:   data,
				mode:   mode
			});
		}
		
		return {
			compress: function compress(mixed: string|byte_array, mode: mode, on_finish: (result: byte_array, error: unknown) => void, on_progress?: on_progress) {
				send_to_worker(action_compress, mixed, mode, on_finish, on_progress);
			},
			decompress: function decompress(byte_arr: byte_array, on_finish: (result: string, error: unknown) => void, on_progress?: on_progress) {
				send_to_worker(action_decompress, byte_arr, false, on_finish, on_progress);
			},
			worker: function worker() {
				return lzma_worker;
			}
		};
	}());
}

type byte_array = number[];
type mode = 1|2|3|4|5|6|7|8|9;
type on_progress = (percent: number) => void;