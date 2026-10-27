// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useEffect as e, useRef as t, useState as n } from "react";
// clients/landing-page/src/services/shader-icon-texture.ts
var r = async (e) => {
	let t = String.fromCodePoint(Number.parseInt(e, 16)), n = "400px \"prompt-studio-icons\"";
	await document.fonts.load(n, t);
	let r = document.createElement("canvas");
	r.width = 512, r.height = 512;
	let i = r.getContext("2d");
	i.font = n, i.fillStyle = "white";
	let a = i.measureText(t), o = a.actualBoundingBoxLeft + a.actualBoundingBoxRight, s = a.actualBoundingBoxAscent + a.actualBoundingBoxDescent;
	return i.fillText(t, (512 - o) / 2 + a.actualBoundingBoxLeft, (512 - s) / 2 + a.actualBoundingBoxAscent), r;
}, i = "\nattribute vec2 a_position;\nvoid main() {\n  gl_Position = vec4(a_position, 0.0, 1.0);\n}", a = (e) => `
precision mediump float;
uniform float u_time;
uniform float u_scale;
uniform vec2 u_resolution;
uniform sampler2D u_icon;
#line 1
${e}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x = (uv.x - 0.5) * u_resolution.x / u_resolution.y + 0.5;
  gl_FragColor = vec4(shade(uv), 1.0);
}`, o = (e, t, n) => {
	let r = e.createShader(t);
	if (e.shaderSource(r, n), e.compileShader(r), !e.getShaderParameter(r, e.COMPILE_STATUS)) {
		let t = e.getShaderInfoLog(r) ?? "The shader could not compile.";
		throw e.deleteShader(r), Error(t);
	}
	return r;
}, s = (e) => {
	let t = e.getContext("webgl", {
		alpha: !1,
		antialias: !1
	});
	if (!t) throw Error("This browser cannot display the shader preview.");
	let n = o(t, t.VERTEX_SHADER, i), r = t.createBuffer();
	t.bindBuffer(t.ARRAY_BUFFER, r), t.bufferData(t.ARRAY_BUFFER, new Float32Array([
		-1,
		-1,
		1,
		-1,
		-1,
		1,
		1,
		1
	]), t.STATIC_DRAW), t.enableVertexAttribArray(0), t.vertexAttribPointer(0, 2, t.FLOAT, !1, 0, 0);
	let s = t.createTexture();
	t.bindTexture(t.TEXTURE_2D, s), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.REPEAT), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.REPEAT), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR_MIPMAP_LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 1, 1, 0, t.RGBA, t.UNSIGNED_BYTE, new Uint8Array([
		0,
		0,
		0,
		0
	]));
	let c = null, l = null;
	return {
		setSource: (e) => {
			let r;
			try {
				r = o(t, t.FRAGMENT_SHADER, a(e));
			} catch (e) {
				return e.message;
			}
			let i = t.createProgram();
			if (t.attachShader(i, n), t.attachShader(i, r), t.bindAttribLocation(i, 0, "a_position"), t.linkProgram(i), t.deleteShader(r), !t.getProgramParameter(i, t.LINK_STATUS)) {
				let e = t.getProgramInfoLog(i) ?? "The shader could not link.";
				return t.deleteProgram(i), e;
			}
			return c && t.deleteProgram(c), c = i, l = {
				time: t.getUniformLocation(c, "u_time"),
				scale: t.getUniformLocation(c, "u_scale"),
				resolution: t.getUniformLocation(c, "u_resolution"),
				icon: t.getUniformLocation(c, "u_icon")
			}, null;
		},
		setIcon: (e) => {
			t.bindTexture(t.TEXTURE_2D, s), t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL, !0), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, t.RGBA, t.UNSIGNED_BYTE, e), t.generateMipmap(t.TEXTURE_2D);
		},
		resize: () => {
			let n = Math.min(window.devicePixelRatio, 2);
			e.width = Math.max(1, Math.round(e.clientWidth * n)), e.height = Math.max(1, Math.round(e.clientHeight * n)), t.viewport(0, 0, e.width, e.height);
		},
		render: (n, r) => {
			t.useProgram(c), l && (t.uniform1i(l.icon, 0), t.uniform1f(l.time, n), t.uniform1f(l.scale, r), t.uniform2f(l.resolution, e.width, e.height), t.drawArrays(t.TRIANGLE_STRIP, 0, 4));
		},
		dispose: () => {
			t.useProgram(null), t.deleteProgram(c), t.deleteBuffer(r), t.deleteTexture(s), t.deleteShader(n), t.getExtension("WEBGL_lose_context")?.loseContext();
		}
	};
}, c = (i, a, o, c) => {
	let l = t(null), u = t(null), d = t(0), f = t(a), [p, m] = n(null), [h, g] = n(!0), [_, v] = n(!1);
	return e(() => {
		let e = l.current, t;
		try {
			t = s(e);
		} catch (e) {
			m(e.message);
			return;
		}
		u.current = t;
		let n = new ResizeObserver(() => {
			t.resize(), t.render(d.current, f.current);
		});
		n.observe(e);
		let r = new IntersectionObserver(([e]) => v(e.isIntersecting));
		r.observe(e);
		let i = window.matchMedia("(prefers-reduced-motion: reduce)"), a = () => g(!i.matches);
		return a(), i.addEventListener("change", a), () => {
			n.disconnect(), r.disconnect(), i.removeEventListener("change", a), t.dispose(), u.current = null;
		};
	}, []), e(() => {
		let e = u.current;
		e && (m(e.setSource(i)), e.render(d.current, f.current));
	}, [i]), e(() => {
		if (!c) return;
		let e = !0;
		return r(c).then((t) => {
			e && (u.current?.setIcon(t), u.current?.render(d.current, f.current));
		}).catch((t) => {
			e && m(t.message);
		}), () => {
			e = !1;
		};
	}, [c]), e(() => {
		f.current = a, u.current?.render(d.current, a);
	}, [a]), e(() => {
		if (!h || !_ || o === 0) return;
		let e = performance.now(), t, n = (r) => {
			let i = Math.min((r - e) / 1e3, .1);
			e = r, document.hidden || (d.current += i * o, u.current?.render(d.current, f.current)), t = requestAnimationFrame(n);
		};
		return t = requestAnimationFrame(n), () => cancelAnimationFrame(t);
	}, [
		h,
		_,
		o
	]), {
		canvasRef: l,
		error: p
	};
};
export { c as t };
