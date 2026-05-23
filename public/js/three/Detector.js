var Detector = {
	webgl: (function () {
		try {
			var canvas = document.createElement('canvas');
			return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
		} catch (e) {
			return false;
		}
	})(),
	addGetWebGLMessage: function () {
		var warning = document.createElement('div');
		warning.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:15px;background:#ffdddd;color:#000;text-align:center;z-index:10000;font-family:monospace;';
		warning.innerHTML = 'This demo requires WebGL. Please use a modern browser that supports WebGL.';
		document.body.appendChild(warning);
	}
};