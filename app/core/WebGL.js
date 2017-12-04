let BasicFragment = [

    "#extension GL_OES_standard_derivatives : enable\n",

    "precision highp float;",

    "uniform sampler2D uSampler;",

    "varying vec2 vLightWeighting;",

    "vec3 normals(vec3 pos) {",
    "    vec3 fdx = dFdx(pos);",
    "    vec3 fdy = dFdy(pos);",
    "    return normalize(cross(fdx, fdy));",
    "}",

    "void main() {",
    "    gl_FragColor = texture2D(uSampler, vLightWeighting);",
    "}"

].join('');

let BasicVertext = [

    "attribute lowp vec3 aVertexPosition;",
    "attribute lowp vec2 aVertexColor;",

    "uniform mat4 uPMVMatrix;",

    "varying vec2 vLightWeighting;",

    "void main(void) {",
    "	gl_Position = uPMVMatrix * vec4(aVertexPosition, 1.0);",
    "	vLightWeighting = aVertexColor;",
    "}"

].join('');

class WebGL {

	constructor (width, height, context, imageData) {

        //Mouse Events
        this.isLeftClickPressed = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
	    this.target = [0, 0, 0];

        //Touch Events
        this.touches = [];
        this.tpCache = [];
        this.tapAttempt = [];
        this.doubleTapCandidate;
        this.isMouseDown = false;
        this.previousDeltaBetween;
        this.TOUCH_THRESHOLD = document.body.clientWidth / 40;
        this.doubleTapCountdown = null;
        this.revt = null;
        this.lastTapEnd = new Date().getTime();


        let aspect_ratio = width / height;

        //Calculate Zoom Based on Windows Size
        this.vfov = 45;
        this.hfov = (2 * Math.atan (Math.tan(this.vfov * .5) * aspect_ratio));

		let back = vec3.scale([0, 0, 1], [0, 0, 1], -Math.max(
		    (1 / Math.tan(this.vfov * 0.5)),
            (1 / Math.tan(this.hfov * 0.5))
        ));
		this.target = vec3.add(this.target, this.target, back);

		//Creates the canvas in which the viewer will be rendered
		this.canvas = document.createElement('canvas');
		this.canvas.style.position = 'absolute';
		this.canvas.style.zIndex = '999';
		this.canvas.style.top = '0';
		this.canvas.style.background = 'background: none rgb(208, 236, 243)';

		context.appendChild(this.canvas);

        //Configure Canvas
        this.canvas.width = width;
        this.canvas.height = height;

        // Initialize the GL context
        this.webgl = this.canvas.getContext(WEBGL);

        //Configure WebGL
        this.webgl.viewport(0, 0, width, height);
        this.webgl.disable(this.webgl.DEPTH_TEST);
        this.webgl.disable(this.webgl.BLEND);
        this.webgl.disable(this.webgl.DITHER);
        this.webgl.disable(this.webgl.POLYGON_OFFSET_FILL);
        this.webgl.disable(this.webgl.SAMPLE_ALPHA_TO_COVERAGE);
        this.webgl.disable(this.webgl.SAMPLE_COVERAGE);
        this.webgl.enable(this.webgl.CULL_FACE);
        this.webgl.getExtension('OES_element_index_uint');
        this.webgl.getExtension('OES_standard_derivatives');

        //Configure Fragment Shader
        let fragmentShared = this.webgl.createShader(this.webgl.FRAGMENT_SHADER);
        //set the source code BasicFragment
        this.webgl.shaderSource(fragmentShared, BasicFragment);
        //compiles a shader into binary data
        this.webgl.compileShader(fragmentShared);

        if (!this.webgl.getShaderParameter(fragmentShared, this.webgl.COMPILE_STATUS)) {
            alert(this.webgl.getShaderInfoLog(fragmentShared));
            return null;
        }

        //Configure Vertext Shader
        let vertextShader = this.webgl.createShader(this.webgl.VERTEX_SHADER);
        //set the source code BasicVertex
        this.webgl.shaderSource(vertextShader, BasicVertex);
        this.webgl.compileShader(vertextShader);

        if (!this.webgl.getShaderParameter(vertextShader, this.webgl.COMPILE_STATUS)) {
            alert(this.webgl.getShaderInfoLog(vertextShader));
            return null;
        }

        //Configure Shader Program
        this.shaderProgram = this.webgl.createProgram();

        this.webgl.attachShader(this.shaderProgram, vertextShader);
        this.webgl.attachShader(this.shaderProgram, fragmentShared);
        this.webgl.linkProgram(this.shaderProgram);
        this.webgl.useProgram(this.shaderProgram);

        //Configure Shader attributes
        this.shaderProgram.vertexPositionAttribute = this.webgl.getAttribLocation(this.shaderProgram, "aVertexPosition");
        this.webgl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

        this.shaderProgram.colorVertexAttribute = this.webgl.getAttribLocation(this.shaderProgram, "aVertexColor");
        this.webgl.enableVertexAttribArray(this.shaderProgram.colorVertexAttribute);

        this.shaderProgram.pPMVatrixUniform = this.webgl.getUniformLocation(this.shaderProgram, "uPMVMatrix");

        //Clear Canvas
        this.webgl.clearColor(0.0, 0.0, 0.0, 0.0);

        //Bind Data to Buffers and Upload to WebGL
        this.verticesBuffer = this.webgl.createBuffer();
        this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, this.verticesBuffer);
        this.webgl.bufferData(this.webgl.ARRAY_BUFFER, new Float32Array([

            // front
            -1.0, -1.0,  0.0,
            1.0, -1.0,  0.0,
            1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0

        ]).buffer, this.webgl.STATIC_DRAW);

        this.colorsBuffer = this.webgl.createBuffer();
        this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, this.colorsBuffer);
        this.webgl.bufferData(this.webgl.ARRAY_BUFFER, new Float32Array([

            // front colors
            0.0, 1.0,
            1.0, 1.0,
            1.0, 0.0,
            0.0, 0.0

        ]).buffer, this.webgl.STATIC_DRAW);

        this.facesBuffer = this.webgl.createBuffer();
        this.webgl.bindBuffer(this.webgl.ELEMENT_ARRAY_BUFFER, this.facesBuffer);
        this.webgl.bufferData(this.webgl.ELEMENT_ARRAY_BUFFER, new Uint32Array([

            // front
            0, 1, 2,
            2, 3, 0

        ]).buffer, this.webgl.STATIC_DRAW);

        //Configure projection matrix
        this.projectionMatrix = mat4.create();
        mat4.perspective(this.projectionMatrix, 45, width / height, 0.001, 1000.0);

        this.interactionTexture = this.webgl.createTexture();

        let viewport = this.webgl.getParameter(this.webgl.VIEWPORT);

        //1. Init Picking Texture
        this.framebuffer_texture = this.webgl.createTexture();
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.framebuffer_texture);
        this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, this.webgl.RGBA, viewport[2], viewport[3], 0, this.webgl.RGBA, this.webgl.UNSIGNED_BYTE, null);

        //2. Init Render Buffer
        this.framebuffer_depthbuffer = this.webgl.createRenderbuffer();
        this.webgl.bindRenderbuffer(this.webgl.RENDERBUFFER, this.framebuffer_depthbuffer);
        this.webgl.renderbufferStorage(this.webgl.RENDERBUFFER, this.webgl.DEPTH_COMPONENT16, viewport[2], viewport[3]);

        //3. Init Frame Buffer
        this.framebuffer = this.webgl.createFramebuffer();
        this.webgl.bindFramebuffer(this.webgl.FRAMEBUFFER, this.framebuffer);
        this.webgl.framebufferTexture2D(this.webgl.FRAMEBUFFER, this.webgl.COLOR_ATTACHMENT0, this.webgl.TEXTURE_2D, this.framebuffer_texture, 0);
        this.webgl.framebufferRenderbuffer(this.webgl.FRAMEBUFFER, this.webgl.DEPTH_ATTACHMENT, this.webgl.RENDERBUFFER, this.framebuffer_depthbuffer);

        this.webgl.bindTexture(this.webgl.TEXTURE_2D, null);
        this.webgl.bindRenderbuffer(this.webgl.RENDERBUFFER, null);
        this.webgl.bindFramebuffer(this.webgl.FRAMEBUFFER, null);
        this.webgl.activeTexture(this.webgl.TEXTURE0);

        this.webgl.activeTexture(this.webgl.TEXTURE0);
        this.mainTexture = this.webgl.createTexture();
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.mainTexture);
        this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, this.webgl.RGBA, this.webgl.RGBA, this.webgl.UNSIGNED_BYTE, imageData);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR);
        this.webgl.generateMipmap(this.webgl.TEXTURE_2D);

        //Render the scene the first time
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('wheel', this.onMouseWheel.bind(this));

        // Create wrappers for touch events
        this.ontouchstart = (event) => this.touchStart(event);
        this.ontouchend = (event) => this.touchEnd(event);
        this.ontouchmove = (event) => this.touchMove(event);
        this.onzoom = (event) => this.zoom(event);
        this.onpan = (event) => this.pan(event);

        //Context listener for touch events
        this.canvas.addEventListener('touchstart', this.ontouchstart);
        this.canvas.addEventListener('touchend', this.ontouchend);
        document.addEventListener('touchmove', this.ontouchmove);
        document.documentElement.addEventListener('gesturestart', function (event) {
            event.preventDefault();
        }, false);

        this.calculateMVMatrix();
	}

    /**
     *
     * @param imageData
     */
	updateDisplayImage (imageData) {
        this.webgl.activeTexture(this.webgl.TEXTURE0);
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.mainTexture);
        this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, this.webgl.RGBA, this.webgl.RGBA, this.webgl.UNSIGNED_BYTE, imageData);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR);
        this.webgl.generateMipmap(this.webgl.TEXTURE_2D);

        this.render();
    }

    /**
     *
     * @param imageData
     */
    updateInteractionMap (imageData) {
        this.webgl.activeTexture(this.webgl.TEXTURE0);
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.interactionTexture);
        this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, this.webgl.RGBA, this.webgl.RGBA, this.webgl.UNSIGNED_BYTE, imageData);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR);
        this.webgl.generateMipmap(this.webgl.TEXTURE_2D);
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.mainTexture);

        this.render();
    }

    /**
     *
     */
	render () {
	    //Clear before draw elements
	    this.webgl.clear(this.webgl.DEPTH_BUFFER_BIT);
        this.webgl.clear(this.webgl.COLOR_BUFFER_BIT);

        this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, this.verticesBuffer);
        this.webgl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, 3, this.webgl.FLOAT, false, 0, 0);

        this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, this.colorsBuffer);
        this.webgl.vertexAttribPointer(this.shaderProgram.colorVertexAttribute, 2, this.webgl.FLOAT, false, 0, 0);

        this.webgl.bindBuffer(this.webgl.ELEMENT_ARRAY_BUFFER, this.facesBuffer);
        this.webgl.drawElements(this.webgl.TRIANGLES, 6, this.webgl.UNSIGNED_INT, 0);
    }

    /**
     *
     * @param event
     */
    onMouseDown (event) {
        this.isLeftClickPressed = event.button === 0;
        this.lastMouseX = event.x;
        this.lastMouseY = event.y;
    }

    /**
     *
     * @param event
     */
    onMouseMove (event) {
        if (!this.isLeftClickPressed) {
            return;
        }

        let right = vec3.scale([1, 0, 0], [1, 0, 0], -(this.lastMouseX - event.x) * 0.001);
        let up = vec3.scale([0, 1, 0], [0, 1, 0], (this.lastMouseY - event.y) * 0.001);

        this.target = vec3.add(this.target, this.target, vec3.add([], right, up));

        this.lastMouseX = event.x;
        this.lastMouseY = event.y;

        this.calculateMVMatrix();
    }

    /**
     *
     * @param event
     */
    onMouseWheel (event) {
        let LOWER_BOUND = -0.06231128944633957;
        let scroll = -event.deltaY * 0.0005;

        if (this.target[2] + scroll > LOWER_BOUND) {
            return;
        }

        let back = vec3.scale([0, 0, 1], [0, 0, 1], scroll);
        this.target = vec3.add(this.target, this.target, back);
        this.calculateMVMatrix();
    }

    /**
     *
     * @param event
     */
    onMouseUp (event) {
        this.isLeftClickPressed = false;
    }

    /**
     *
     * @param event
     */
    touchStart (event) {
        event.preventDefault();
        event.stopPropagation();

        for (let i = 0; i < event.changedTouches.length; ++i) {
            let touch = event.changedTouches[i];
            touch.timestamp = Date.now();
            this.tapAttempt.push(touch);
        }

        //Sets lastX and lastY to current mouse coordinates
        this.lastMouseX = event.changedTouches[0].clientX;
        this.lastMouseY = event.changedTouches[0].clientY;

        this.tpCache = event.targetTouches;
    }

    /**
     *
     * @param event
     */
    touchMove (event) {
        let deltax = (this.tpCache[0]) ? event.targetTouches[0].clientX - this.tpCache[0].clientX : event.targetTouches[0].clientX,
            deltay = (this.tpCache[0]) ? event.targetTouches[0].clientY - this.tpCache[0].clientY : event.targetTouches[0].clientY;

        if (deltax >= this.TOUCH_THRESHOLD || deltax <= -this.TOUCH_THRESHOLD ||
            deltay >= this.TOUCH_THRESHOLD || deltay <= -this.TOUCH_THRESHOLD) {

            if (this.tpCache.length == 1) {
                this.canvas.addEventListener('touchmove', this.onpan);
            } else if (this.tpCache.length == 2) {
                this.canvas.addEventListener('touchmove', this.onzoom);
            }

            this.canvas.removeEventListener('touchstart', this.ontouchstart);
            this.canvas.removeEventListener('touchmove', this.ontouchmove);
        }
    }

    /**
     *
     * @param event
     */
    touchEnd (event) {
        this.canvas.addEventListener('touchstart', this.ontouchstart);
        this.canvas.addEventListener('touchmove', this.ontouchmove);

        this.canvas.removeEventListener('touchmove', this.onpan);
        this.canvas.removeEventListener('touchmove', this.onzoom);
        this.canvas.removeEventListener('touchend', this.touchend);

        this.isMouseDown = false;
        this.previousDeltaBetween = null;
        this.tpCache = [];

        this.lastTapEnd = new Date().getTime();
    }

    /**
     *
     * @param event
     */
    pan (event) {
        event.preventDefault();
        event.stopPropagation();

        let deltax = event.targetTouches[0].clientX - this.tpCache[0].clientX,
            deltay = event.targetTouches[0].clientY - this.tpCache[0].clientY;

        if (deltax >= this.TOUCH_THRESHOLD || deltax <= -this.TOUCH_THRESHOLD ||
            deltay >= this.TOUCH_THRESHOLD || deltay <= -this.TOUCH_THRESHOLD) {

            //Current mouse coordinates
            let x = event.changedTouches[0].clientX;
            let y = event.changedTouches[0].clientY;

            // X translation and Y translation setted to the difference between the last mouse
            // position and the current
            let right = vec3.scale([1, 0, 0], [1, 0, 0], -(this.lastMouseX - x) * 0.001);
            let up = vec3.scale([0, 1, 0], [0, 1, 0], (this.lastMouseY - y) * 0.001);

            this.target = vec3.add(this.target, this.target, vec3.add([], right, up));

            // Sets new Matrix Position to the Group
            requestAnimationFrame(this.calculateMVMatrix.bind(this));

            //Sets lastX and lastY to current mouse coordinates
            this.lastMouseX = event.changedTouches[0].clientX;
            this.lastMouseY = event.changedTouches[0].clientY;
        }

    }

    /**
     * Apply zoom in or zoom out to image
     * @param event
     */
    zoom (event) {
        event.preventDefault();
        event.stopPropagation();

        let delta_between =
            ((Math.abs(event.targetTouches[0].clientX - event.targetTouches[1].clientX) << 1) +
                (Math.abs(event.targetTouches[0].clientY - event.targetTouches[1].clientY) << 1)) >> 1;

        if (!this.previousDeltaBetween) {
            this.previousDeltaBetween = delta_between;
        }



        //Retrieves amount scrolled
        let scroll = -(delta_between - this.previousDeltaBetween) * 5,
            back = vec3.scale([0, 0, 1], [0, 0, 1], -scroll * 0.00005);

        let LOWER_BOUND = -0.06231128944633957;

        if (this.target[2] + scroll > LOWER_BOUND) {
            return;
        }

        this.target = vec3.add(this.target, this.target, back);
        this.calculateMVMatrix();
    }

    /**
     *
     * @param x
     * @param y
     * @returns {*}
     */
    getPixelColorAt (x, y) {

        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.interactionTexture);

        this.webgl.enable(this.webgl.SCISSOR_TEST);
        this.webgl.scissor(x, this.canvas.height - y, 1, 1);
        this.webgl.activeTexture(this.webgl.TEXTURE1);
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.framebuffer_texture);
        this.webgl.bindRenderbuffer(this.webgl.RENDERBUFFER, this.framebuffer_depthbuffer);
        this.webgl.bindFramebuffer(this.webgl.FRAMEBUFFER, this.framebuffer);

        this.render();

        var readout = new Uint8Array(4);

        this.webgl.readPixels(
            x,
            this.canvas.height - y,
            1,
            1,
            this.webgl.RGBA,
            this.webgl.UNSIGNED_BYTE,
            readout
        );

        let readout2 = readout[2];
            readout[2] = readout[0];
            readout[0] = readout2;
            readout[3] = 0;

        //Clean up
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, null);
        this.webgl.bindRenderbuffer(this.webgl.RENDERBUFFER, null);
        this.webgl.bindFramebuffer(this.webgl.FRAMEBUFFER, null);
        this.webgl.activeTexture(this.webgl.TEXTURE0);
        this.webgl.disable(this.webgl.SCISSOR_TEST);
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.mainTexture);

        return (new Uint32Array(readout.buffer)[0]);
    }

    /**
     *
     */
    calculateMVMatrix () {
        let _mvMatrix = mat4.identity(mat4.create());

        _mvMatrix = mat4.translate(_mvMatrix, _mvMatrix, this.target);

        let pMVPMatrixUniform = [];
        mat4.multiply (pMVPMatrixUniform, this.projectionMatrix, _mvMatrix);
        this.webgl.uniformMatrix4fv(this.shaderProgram.pPMVatrixUniform, false, pMVPMatrixUniform);

        requestAnimationFrame(this.render.bind(this));
    }

    /**
     *
     */
    setCameraPositionAt (position) {
        this.target = [
            position[2],
            position[3],
            -Math.max(
                (position[0] / Math.tan(this.hfov * 0.5)),
                (position[1] / Math.tan(this.vfov * 0.5))
            )
        ]

        this.calculateMVMatrix();
    }

}

export default WebGL;