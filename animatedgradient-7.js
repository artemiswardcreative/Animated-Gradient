//Converting colors to proper format
function normalizeColor(hexCode) {
    return [(hexCode >> 16 & 255) / 255, (hexCode >> 8 & 255) / 255, (255 & hexCode) / 255]
  } ["SCREEN", "LINEAR_LIGHT"].reduce((hexCode, t, n) => Object.assign(hexCode, {
    [t]: n
  }), {});
  
  //Essential functionality of WebGl
  //t = width
  //n = height
  class MiniGl {
    constructor(canvas, width, height, debug = false) {
        const _miniGl = this,
            debug_output = -1 !== document.location.search.toLowerCase().indexOf("debug=webgl");
        _miniGl.canvas = canvas, _miniGl.gl = _miniGl.canvas.getContext("webgl", {
            antialias: false, // Turn off antialiasing for performance
            alpha: true,      // Keep alpha channel for transparency
            depth: false,     // No need for depth testing in 2D effects
            stencil: false,   // No need for stencil buffer
            preserveDrawingBuffer: false, // Better performance
            powerPreference: "high-performance" // Request high performance GPU if available            
        }), _miniGl.meshes = [];
        const context = _miniGl.gl;
        width && height && this.setSize(width, height), _miniGl.lastDebugMsg, _miniGl.debug = debug && debug_output ? function(e) {
            const t = new Date;
            t - _miniGl.lastDebugMsg > 1e3 && console.log("---"), console.log(t.toLocaleTimeString() + Array(Math.max(0, 32 - e.length)).join(" ") + e + ": ", ...Array.from(arguments).slice(1)), _miniGl.lastDebugMsg = t
        } : () => {}, Object.defineProperties(_miniGl, {
            Material: {
                enumerable: false,
                value: class {
                    constructor(vertexShaders, fragments, uniforms = {}) {
                        const material = this;
                        function getShaderByType(type, source) {
                            const shader = context.createShader(type);
                            return context.shaderSource(shader, source), context.compileShader(shader), context.getShaderParameter(shader, context.COMPILE_STATUS) || console.error(context.getShaderInfoLog(shader)), _miniGl.debug("Material.compileShaderSource", {
                                source: source
                            }), shader
                        }
                        function getUniformVariableDeclarations(uniforms, type) {
                            return Object.entries(uniforms).map(([uniform, value]) => value.getDeclaration(uniform, type)).join("\n")
                        }
                        material.uniforms = uniforms, material.uniformInstances = [];
  
                        const prefix = "\n              precision highp float;\n            ";
                        material.vertexSource = `\n              ${prefix}\n              attribute vec4 position;\n              attribute vec2 uv;\n              attribute vec2 uvNorm;\n              ${getUniformVariableDeclarations(_miniGl.commonUniforms,"vertex")}\n              ${getUniformVariableDeclarations(uniforms,"vertex")}\n              ${vertexShaders}\n            `,
                        material.Source = `\n              ${prefix}\n              ${getUniformVariableDeclarations(_miniGl.commonUniforms,"fragment")}\n              ${getUniformVariableDeclarations(uniforms,"fragment")}\n              ${fragments}\n            `,
                        material.vertexShader = getShaderByType(context.VERTEX_SHADER, material.vertexSource),
                        material.fragmentShader = getShaderByType(context.FRAGMENT_SHADER, material.Source),
                        material.program = context.createProgram(),
                        context.attachShader(material.program, material.vertexShader),
                        context.attachShader(material.program, material.fragmentShader),
                        context.linkProgram(material.program),
                        context.getProgramParameter(material.program, context.LINK_STATUS) || console.error(context.getProgramInfoLog(material.program)),
                        context.useProgram(material.program),
                        material.attachUniforms(void 0, _miniGl.commonUniforms),
                        material.attachUniforms(void 0, material.uniforms)
                    }
                    //t = uniform
                    attachUniforms(name, uniforms) {
                        //n  = material
                        const material = this;
                        void 0 === name ? Object.entries(uniforms).forEach(([name, uniform]) => {
                            material.attachUniforms(name, uniform)
                        }) : "array" == uniforms.type ? uniforms.value.forEach((uniform, i) => material.attachUniforms(`${name}[${i}]`, uniform)) : "struct" == uniforms.type ? Object.entries(uniforms.value).forEach(([uniform, i]) => material.attachUniforms(`${name}.${uniform}`, i)) : (_miniGl.debug("Material.attachUniforms", {
                            name: name,
                            uniform: uniforms
                        }), material.uniformInstances.push({
                            uniform: uniforms,
                            location: context.getUniformLocation(material.program, name)
                        }))
                    }
                }
            },
            Uniform: {
                enumerable: !1,
                value: class {
                    constructor(e) {
                        this.type = "float", Object.assign(this, e);
                        this.typeFn = {
                            float: "1f",
                            int: "1i",
                            vec2: "2fv",
                            vec3: "3fv",
                            vec4: "4fv",
                            mat4: "Matrix4fv"
                        } [this.type] || "1f", this.update()
                    }
                    update(value) {
                        void 0 !== this.value && context[`uniform${this.typeFn}`](value, 0 === this.typeFn.indexOf("Matrix") ? this.transpose : this.value, 0 === this.typeFn.indexOf("Matrix") ? this.value : null)
                    }
                    //e - name
                    //t - type
                    //n - length
                    getDeclaration(name, type, length) {
                        const uniform = this;
                        if (uniform.excludeFrom !== type) {
                            if ("array" === uniform.type) return uniform.value[0].getDeclaration(name, type, uniform.value.length) + `\nconst int ${name}_length = ${uniform.value.length};`;
                            if ("struct" === uniform.type) {
                                let name_no_prefix = name.replace("u_", "");
                                return name_no_prefix = 
                                  name_no_prefix.charAt(0).toUpperCase() + 
                                  name_no_prefix.slice(1), 
                                  `uniform struct ${name_no_prefix} 
                                  {\n` + 
                                  Object.entries(uniform.value).map(([name, uniform]) => 
                                  uniform.getDeclaration(name, type)
                                  .replace(/^uniform/, ""))
                                  .join("") 
                                  + `\n} ${name}${length>0?`[${length}]`:""};`
                            }
                            return `uniform ${uniform.type} ${name}${length>0?`[${length}]`:""};`
                        }
                    }
                }
            },
            PlaneGeometry: {
                enumerable: !1,
                value: class {
                    constructor(width, height, n, i, orientation) {
                      context.createBuffer(), this.attributes = {
                            position: new _miniGl.Attribute({
                                target: context.ARRAY_BUFFER,
                                size: 3
                            }),
                            uv: new _miniGl.Attribute({
                                target: context.ARRAY_BUFFER,
                                size: 2
                            }),
                            uvNorm: new _miniGl.Attribute({
                                target: context.ARRAY_BUFFER,
                                size: 2
                            }),
                            index: new _miniGl.Attribute({
                                target: context.ELEMENT_ARRAY_BUFFER,
                                size: 3,
                                type: context.UNSIGNED_SHORT
                            })
                        }, this.setTopology(n, i), this.setSize(width, height, orientation)
                    }
                    setTopology(e = 1, t = 1) {
                        const n = this;
                        n.xSegCount = e, n.ySegCount = t, n.vertexCount = (n.xSegCount + 1) * (n.ySegCount + 1), n.quadCount = n.xSegCount * n.ySegCount * 2, n.attributes.uv.values = new Float32Array(2 * n.vertexCount), n.attributes.uvNorm.values = new Float32Array(2 * n.vertexCount), n.attributes.index.values = new Uint16Array(3 * n.quadCount);
                        for (let e = 0; e <= n.ySegCount; e++)
                            for (let t = 0; t <= n.xSegCount; t++) {
                                const i = e * (n.xSegCount + 1) + t;
                                if (n.attributes.uv.values[2 * i] = t / n.xSegCount, n.attributes.uv.values[2 * i + 1] = 1 - e / n.ySegCount, n.attributes.uvNorm.values[2 * i] = t / n.xSegCount * 2 - 1, n.attributes.uvNorm.values[2 * i + 1] = 1 - e / n.ySegCount * 2, t < n.xSegCount && e < n.ySegCount) {
                                    const s = e * n.xSegCount + t;
                                    n.attributes.index.values[6 * s] = i, n.attributes.index.values[6 * s + 1] = i + 1 + n.xSegCount, n.attributes.index.values[6 * s + 2] = i + 1, n.attributes.index.values[6 * s + 3] = i + 1, n.attributes.index.values[6 * s + 4] = i + 1 + n.xSegCount, n.attributes.index.values[6 * s + 5] = i + 2 + n.xSegCount
                                }
                            }
                        n.attributes.uv.update(), n.attributes.uvNorm.update(), n.attributes.index.update(), _miniGl.debug("Geometry.setTopology", {
                            uv: n.attributes.uv,
                            uvNorm: n.attributes.uvNorm,
                            index: n.attributes.index
                        })
                    }
                    setSize(width = 1, height = 1, orientation = "xz") {
                        const geometry = this;
                        geometry.width = width,
                        geometry.height = height,
                        geometry.orientation = orientation,
                        geometry.attributes.position.values && geometry.attributes.position.values.length === 3 * geometry.vertexCount 
                        || (geometry.attributes.position.values = new Float32Array(3 * geometry.vertexCount));
                        const o = width / -2,
                            r = height / -2,
                            segment_width = width / geometry.xSegCount,
                            segment_height = height / geometry.ySegCount;
                        for (let yIndex= 0; yIndex <= geometry.ySegCount; yIndex++) {
                            const t = r + yIndex * segment_height;
                            for (let xIndex = 0; xIndex <= geometry.xSegCount; xIndex++) {
                                const r = o + xIndex * segment_width,
                                    l = yIndex * (geometry.xSegCount + 1) + xIndex;
                                geometry.attributes.position.values[3 * l + "xyz".indexOf(orientation[0])] = r, 
                                geometry.attributes.position.values[3 * l + "xyz".indexOf(orientation[1])] = -t
                            }
                        }
                        geometry.attributes.position.update(), _miniGl.debug("Geometry.setSize", {
                            position: geometry.attributes.position
                        })
                    }
                }
            },
            Mesh: {
                enumerable: !1,
                value: class {
                    constructor(geometry, material) {
                        const mesh = this;
                        mesh.geometry = geometry, mesh.material = material, mesh.wireframe = !1, mesh.attributeInstances = [], Object.entries(mesh.geometry.attributes).forEach(([e, attribute]) => {
                            mesh.attributeInstances.push({
                                attribute: attribute,
                                location: attribute.attach(e, mesh.material.program)
                            })
                        }), _miniGl.meshes.push(mesh), _miniGl.debug("Mesh.constructor", {
                            mesh: mesh
                        })
                    }
                    draw() {
                      context.useProgram(this.material.program), this.material.uniformInstances.forEach(({
                            uniform: e,
                            location: t
                        }) => e.update(t)), this.attributeInstances.forEach(({
                            attribute: e,
                            location: t
                        }) => e.use(t)), context.drawElements(this.wireframe ? context.LINES : context.TRIANGLES, this.geometry.attributes.index.values.length, context.UNSIGNED_SHORT, 0)
                    }
                    remove() {
                        _miniGl.meshes = _miniGl.meshes.filter(e => e != this)
                    }
                }
            },
            Attribute: {
                enumerable: !1,
                value: class {
                    constructor(e) {
                        this.type = context.FLOAT, this.normalized = !1, this.buffer = context.createBuffer(), Object.assign(this, e), this.update()
                    }
                    update() {
                        void 0 !== this.values && (context.bindBuffer(this.target, this.buffer), context.bufferData(this.target, this.values, context.STATIC_DRAW))
                    }
                    attach(e, t) {
                        const n = context.getAttribLocation(t, e);
                        return this.target === context.ARRAY_BUFFER && (context.enableVertexAttribArray(n), context.vertexAttribPointer(n, this.size, this.type, this.normalized, 0, 0)), n
                    }
                    use(e) {
                      context.bindBuffer(this.target, this.buffer), this.target === context.ARRAY_BUFFER && (context.enableVertexAttribArray(e), context.vertexAttribPointer(e, this.size, this.type, this.normalized, 0, 0))
                    }
                }
            }
        });
        const a = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        _miniGl.commonUniforms = {
            projectionMatrix: new _miniGl.Uniform({
                type: "mat4",
                value: a
            }),
            modelViewMatrix: new _miniGl.Uniform({
                type: "mat4",
                value: a
            }),
            resolution: new _miniGl.Uniform({
                type: "vec2",
                value: [1, 1]
            }),
            aspectRatio: new _miniGl.Uniform({
                type: "float",
                value: 1
            })
        }
    }
    setSize(e = 640, t = 480) {
        this.width = e, this.height = t, this.canvas.width = e, this.canvas.height = t, this.gl.viewport(0, 0, e, t), this.commonUniforms.resolution.value = [e, t], this.commonUniforms.aspectRatio.value = e / t, this.debug("MiniGL.setSize", {
            width: e,
            height: t
        })
    }
    //left, right, top, bottom, near, far
    setOrthographicCamera(e = 0, t = 0, n = 0, i = -2e3, s = 2e3) {
        this.commonUniforms.projectionMatrix.value = [2 / this.width, 0, 0, 0, 0, 2 / this.height, 0, 0, 0, 0, 2 / (i - s), 0, e, t, n, 1], this.debug("setOrthographicCamera", this.commonUniforms.projectionMatrix.value)
    }
    render() {
        this.gl.clearColor(0, 0, 0, 0), this.gl.clearDepth(1), this.meshes.forEach(e => e.draw())
    }
  }
  
  
  
  //Sets initial properties
  function e(object, propertyName, val) {
    return propertyName in object ? Object.defineProperty(object, propertyName, {
        value: val,
        enumerable: !0,
        configurable: !0,
        writable: !0
    }) : object[propertyName] = val, object
  }

  
  
  //Gradient object
  class Gradient {
    constructor(...t) {
        e(this, "el", void 0), e(this, "cssVarRetries", 0), e(this, "maxCssVarRetries", 200), e(this, "angle", 0), e(this, "isLoadedClass", !1), e(this, "isScrolling", !1), /*e(this, "isStatic", o.disableAmbientAnimations()),*/ e(this, "scrollingTimeout", void 0), e(this, "scrollingRefreshDelay", 200), e(this, "isIntersecting", !1), e(this, "shaderFiles", void 0), e(this, "vertexShader", void 0), e(this, "sectionColors", void 0), e(this, "computedCanvasStyle", void 0), e(this, "conf", void 0), e(this, "uniforms", void 0), e(this, "t", 1253106), e(this, "last", 0), e(this, "width", void 0), e(this, "minWidth", 1111), e(this, "height", 600), e(this, "xSegCount", void 0), e(this, "ySegCount", void 0), e(this, "mesh", void 0), e(this, "material", void 0), e(this, "geometry", void 0), e(this, "minigl", void 0), e(this, "scrollObserver", void 0), e(this, "amp", 30), e(this, "seed", 5), e(this, "freqX", 14e-5), e(this, "freqY", 29e-5), e(this, "freqDelta", 1e-5), e(this, "activeColors", [1, 1, 1, 1]), e(this, "isMetaKey", !1), e(this, "isGradientLegendVisible", !1), e(this, "isMouseDown", !1), e(this, "handleScroll", () => {
            clearTimeout(this.scrollingTimeout), this.scrollingTimeout = setTimeout(this.handleScrollEnd, this.scrollingRefreshDelay), this.isGradientLegendVisible && this.hideGradientLegend(), this.conf.playing && (this.isScrolling = !0, this.pause())
        }), e(this, "handleScrollEnd", () => {
            this.isScrolling = !1, this.isIntersecting && this.play()
        }), e(this, "resize", () => {
            this.width = window.innerWidth, this.minigl.setSize(this.width, this.height), this.minigl.setOrthographicCamera(), this.xSegCount = Math.ceil(this.width * this.conf.density[0]), this.ySegCount = Math.ceil(this.height * this.conf.density[1]), this.mesh.geometry.setTopology(this.xSegCount, this.ySegCount), this.mesh.geometry.setSize(this.width, this.height), this.mesh.material.uniforms.u_shadow_power.value = this.width < 600 ? 5 : 6;
            this.uniforms.u_aspect_ratio.value = this.width / this.height;
            console.log('Aspect ratio:', this.width / this.height);

        }), e(this, "handleMouseDown", e => {
            this.isGradientLegendVisible && (this.isMetaKey = e.metaKey, this.isMouseDown = !0, !1 === this.conf.playing && requestAnimationFrame(this.animate))
        }), e(this, "handleMouseUp", () => {
            this.isMouseDown = !1
        }), e(this, "animate", (currentTime) => {
            // Only update time if we're animating
            if (this.conf.playing || this.isMouseDown) {
              // Use stable delta time (capped at 60fps equivalent)
              const deltaTime = this.last ? Math.min(currentTime - this.last, 16.67) : 16.67;
              this.t += deltaTime;
              this.last = currentTime;
              
              // Add mouse-based time adjustment if needed
              if (this.isMouseDown) {
                this.t += this.isMetaKey ? -160 : 160;
              }
              
              // Only update uniform if actually changed
              this.mesh.material.uniforms.u_time.value = this.t;
              
              // Render frame
              this.minigl.render();
              
              // Request next frame if still active
              requestAnimationFrame(this.animate);
            }
        }), e(this, "addIsLoadedClass", () => {
            /*this.isIntersecting && */!this.isLoadedClass && (this.isLoadedClass = !0, this.el.classList.add("isLoaded"), setTimeout(() => {
                this.el.parentElement.classList.add("isLoaded")
            }, 3e3))
        }), e(this, "pause", () => {
            this.conf.playing = false
        }), e(this, "play", () => {
            requestAnimationFrame(this.animate), this.conf.playing = true
        }), e(this,"initGradient", (selector) => {
          this.el = document.querySelector(selector);
          this.computedCanvasStyle = getComputedStyle(this.el);

          this.el.addEventListener('mousemove', (event) => {
            this.onMouseMove(event)
          });

          this.connect();
          return this;
        }),
        e(this, "adaptMeshDensity", () => {
            // Measure performance by timing a single frame render
            const start = performance.now();
            this.minigl.render();
            const duration = performance.now() - start;
            
            // If rendering is slow, reduce mesh density
            if (duration > 8) { // More than 8ms to render a frame
              this.conf.density = [
                Math.max(0.1, this.conf.density[0] * 0.75),
                Math.max(0.1, this.conf.density[1] * 0.75)
              ];
              
              // Update mesh with new density
              this.xSegCount = Math.ceil(this.width * this.conf.density[0]);
              this.ySegCount = Math.ceil(this.height * this.conf.density[1]);
              this.mesh.geometry.setTopology(this.xSegCount, this.ySegCount);
              this.mesh.geometry.setSize(this.width, this.height);
            }
          })
        this.mouse = []
        this.mouse2 = []
       
        this.lastMousePos = [0, 0];
        this.mouseVelocity = 0;
        this.lastRippleTime = 0;
        this.rippleThrottleInterval = 100; // Milliseconds between ripples (adjust as needed)

          

    }
    async connect() {
        this.shaderFiles = {
            vertex: `
varying vec3 v_color;
varying float v_displacement;

void main() {
  float time = u_time * u_global.noiseSpeed;
  
  vec2 noiseCoord = resolution * uvNorm * u_global.noiseFreq;
  vec2 st = 1. - uvNorm.xy;

  // Edge clamping
  float distanceFromTop = 1.0 - uv.y;
  float distanceFromBottom = uv.y;
  float edgeThreshold = 0.1;
  float topFalloff = smoothstep(0.0, edgeThreshold, distanceFromTop);
  float bottomFalloff = smoothstep(0.0, edgeThreshold, distanceFromBottom);

  // Variables for ripple calculation
  float totalRippleInfluence = 0.0;
  float finalSteepness = 0.0;
  float interferenceForce = 0.0;
  
  // Pre-calculate aspect ratio adjustment factor
  float aspectAdjust = u_aspect_ratio / 1.5;
  
  // Precalculate common wave parameters
  float speed = 0.0005;
  float spacing = 0.05;
  float waveWidth = 0.05; // Common width parameter for exp() calculations
  float waveWidthSq = waveWidth * waveWidth; // Square for optimization
  
  // Arrays for interference calculations - defined at root level
  float waveHeights[4];
  float waveSteepness[4];
  
  // Store ripple distances and times for reuse
  vec2 rDistances[4];
  float distFromRipples[4];
  float elapsedTimes[4];
  float mouseVelocities[4];
  bool rippleActive[4];
  
  // First pass: pre-calculate distances and times
  for (int r = 0; r < 4; r++) {
    rippleActive[r] = r < u_active_ripples;
    
    vec2 ripplePoint;
    if (r == 0) ripplePoint = u_ripple_point0;
    else if (r == 1) ripplePoint = u_ripple_point1;
    else if (r == 2) ripplePoint = u_ripple_point2;
    else ripplePoint = u_ripple_point3;
    
    rDistances[r] = vec2(
      (uvNorm.x - ripplePoint.x) * aspectAdjust,
      uvNorm.y - ripplePoint.y
    );
    
    distFromRipples[r] = length(rDistances[r]);
    
    // Precalculate time values
    if (r == 0) mouseVelocities[r] = u_mouse_velocity0;
    else if (r == 1) mouseVelocities[r] = u_mouse_velocity1;
    else if (r == 2) mouseVelocities[r] = u_mouse_velocity2;
    else mouseVelocities[r] = u_mouse_velocity3;
    
    if (r == 0) elapsedTimes[r] = u_time - u_ripple_time0;
    else if (r == 1) elapsedTimes[r] = u_time - u_ripple_time1;
    else if (r == 2) elapsedTimes[r] = u_time - u_ripple_time2;
    else elapsedTimes[r] = u_time - u_ripple_time3;
  }
  
  // Process all ripples (0-3)
  for (int r = 0; r < 4; r++) {
    // Initialize with zeros
    waveHeights[r] = 0.0;
    waveSteepness[r] = 0.0;
    
    if (!rippleActive[r]) continue;
    
    float rippleInfluence = 0.0;
    float rippleSteepness = 0.0;
    
    // Reuse distance calculation from earlier
    float distFromRipple = distFromRipples[r];
    float elapsedTime = elapsedTimes[r];
    float mouseVelocity = mouseVelocities[r];
    
    // Base amplitude calculation for all waves in this ripple
    float baseAmp = 30.0 * (0.5 + mouseVelocity);
    
    // Calculate radius of expanding ripple
    float radius = elapsedTime * speed;
    
    // First wave (depression) - precalculate common factors
    float distDiff = distFromRipple - radius;
    float distDiffSq = distDiff * distDiff;
    float expFactor = -distDiffSq / waveWidthSq;
    float waveShape = exp(expFactor);
    
    // Add main wave depression
    float mainWave = -waveShape * baseAmp;
    rippleInfluence += mainWave;
    
    // Calculate wave steepness
    float mainSteepness = -2.0 * distDiff * waveShape * baseAmp / waveWidthSq;
    rippleSteepness += mainSteepness;
    
    // First trailing wave (crest)
    float trail1Radius = radius - spacing;
    if (trail1Radius > 0.0) {
      distDiff = distFromRipple - trail1Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.2);
      float trail1Amp = (baseAmp * 0.6) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail1Wave = waveShape * trail1Amp;
      rippleInfluence += trail1Wave;
      
      float trail1Steepness = 2.0 * distDiff * waveShape * trail1Amp / waveWidthSq;
      rippleSteepness += trail1Steepness;
    }
    
    // Second trailing wave (trough)
    float trail2Radius = radius - (spacing * 2.0);
    if (trail2Radius > 0.0) {
      distDiff = distFromRipple - trail2Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.3);
      float trail2Amp = (baseAmp * 0.5) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail2Wave = -waveShape * trail2Amp;
      rippleInfluence += trail2Wave;
      
      float trail2Steepness = -2.0 * distDiff * waveShape * trail2Amp / waveWidthSq;
      rippleSteepness += trail2Steepness;
    }
    
    // Remaining trailing waves - same pattern repeated with different parameters
    // Third trailing wave (crest)
    float trail3Radius = radius - (spacing * 3.0);
    if (trail3Radius > 0.0) {
      distDiff = distFromRipple - trail3Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.4);
      float trail3Amp = (baseAmp * 0.4) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail3Wave = waveShape * trail3Amp;
      rippleInfluence += trail3Wave;
      
      float trail3Steepness = 2.0 * distDiff * waveShape * trail3Amp / waveWidthSq;
      rippleSteepness += trail3Steepness;
    }
    
    // Fourth trailing wave (trough)
    float trail4Radius = radius - (spacing * 4.0);
    if (trail4Radius > 0.0) {
      distDiff = distFromRipple - trail4Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.5);
      float trail4Amp = (baseAmp * 0.03) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail4Wave = -waveShape * trail4Amp;
      rippleInfluence += trail4Wave;
      
      float trail4Steepness = -2.0 * distDiff * waveShape * trail4Amp / waveWidthSq;
      rippleSteepness += trail4Steepness;
    }

    // 5th trailing wave (crest)
    float trail5Radius = radius - (spacing * 8.0);
    if (trail5Radius > 0.0) {
      distDiff = distFromRipple - trail5Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.1);
      float trail5Amp = (baseAmp * 0.05) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail5Wave = waveShape * trail5Amp;
      rippleInfluence += trail5Wave;
      
      float trail5Steepness = -2.0 * distDiff * waveShape * trail5Amp / waveWidthSq;
      rippleSteepness += trail5Steepness;
    }

    // 6th trailing wave (trough)
    float trail6Radius = radius - (spacing * 12.0);
    if (trail6Radius > 0.0) {
      distDiff = distFromRipple - trail6Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.7);
      float trail6Amp = (baseAmp * 0.03) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail6Wave = -waveShape * trail6Amp;
      rippleInfluence += trail6Wave;
      
      float trail6Steepness = -2.0 * distDiff * waveShape * trail6Amp / waveWidthSq;
      rippleSteepness += trail6Steepness;
    }

    // 7th trailing wave (crest)
    float trail7Radius = radius - (spacing * 16.0);
    if (trail7Radius > 0.0) {
      distDiff = distFromRipple - trail7Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.8);
      float trail7Amp = (baseAmp * 0.01) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail7Wave = waveShape * trail7Amp;
      rippleInfluence += trail7Wave;
      
      float trail7Steepness = -2.0 * distDiff * waveShape * trail7Amp / waveWidthSq;
      rippleSteepness += trail7Steepness;
    }

    // 8th trailing wave (trough)
    float trail8Radius = radius - (spacing * 20.0);
    if (trail8Radius > 0.0) {
      distDiff = distFromRipple - trail8Radius;
      distDiffSq = distDiff * distDiff;
      float decay = exp(-0.9);
      float trail8Amp = (baseAmp * 0.005) * decay;
      expFactor = -distDiffSq / waveWidthSq;
      waveShape = exp(expFactor);
      
      float trail8Wave = -waveShape * trail8Amp;
      rippleInfluence += trail8Wave;
      
      float trail8Steepness = -2.0 * distDiff * waveShape * trail8Amp / waveWidthSq;
      rippleSteepness += trail8Steepness;
    }
    
    // Store calculated values
    waveHeights[r] = rippleInfluence;
    waveSteepness[r] = rippleSteepness;
  }
  
  // Calculate wave interference - linear superposition with optimization
  // Add linear wave heights
  for (int i = 0; i < 4; i++) {
    totalRippleInfluence += waveHeights[i];
    finalSteepness += waveSteepness[i];
  }
  
  // Simplified interference - only calculate between significant waves
  


if (u_active_ripples > 1) {
  // Calculate the average steepness magnitude for active waves
  float totalSteepness = 0.0;
  float wavesCount = 0.0;
  
  for (int i = 0; i < 4; i++) {
    if (i >= u_active_ripples) continue;
    totalSteepness += abs(waveSteepness[i]);
    wavesCount += 1.0;
  }
  
  float avgSteepness = totalSteepness / max(1.0, wavesCount);
  
  // Pair 0-1
  if (abs(waveSteepness[0]) > 0.05 && abs(waveSteepness[1]) > 0.05) {
    // Calculate raw product
    float rawInteraction = waveSteepness[0] * waveSteepness[1];
    
    // Non-linear mapping function - tanh-like behavior
    float scale = 0.00003;
    float dampFactor = 1.0 / (1.0 + abs(rawInteraction) * 10.0); 
    interferenceForce += rawInteraction * scale * dampFactor;
  }
  
  if (u_active_ripples > 2) {
    // Pair 0-2
    if (abs(waveSteepness[0]) > 0.05 && abs(waveSteepness[2]) > 0.05) {
      float rawInteraction = waveSteepness[0] * waveSteepness[2];
      float scale = 0.00003;
      float dampFactor = 1.0 / (1.0 + abs(rawInteraction) * 10.0);
      interferenceForce += rawInteraction * scale * dampFactor;
    }
    
    // Pair 1-2
    if (abs(waveSteepness[1]) > 0.05 && abs(waveSteepness[2]) > 0.05) {
      float rawInteraction = waveSteepness[1] * waveSteepness[2];
      float scale = 0.00003;
      float dampFactor = 1.0 / (1.0 + abs(rawInteraction) * 10.0);
      interferenceForce += rawInteraction * scale * dampFactor;
    }
    
    if (u_active_ripples > 3) {
      // Pair 0-3
      if (abs(waveSteepness[0]) > 0.05 && abs(waveSteepness[3]) > 0.05) {
        float rawInteraction = waveSteepness[0] * waveSteepness[3];
        float scale = 0.00003;
        float dampFactor = 1.0 / (1.0 + abs(rawInteraction) * 10.0);
        interferenceForce += rawInteraction * scale * dampFactor;
      }
      
      // Pair 1-3
      if (abs(waveSteepness[1]) > 0.05 && abs(waveSteepness[3]) > 0.05) {
        float rawInteraction = waveSteepness[1] * waveSteepness[3];
        float scale = 0.00003;
        float dampFactor = 1.0 / (1.0 + abs(rawInteraction) * 10.0);
        interferenceForce += rawInteraction * scale * dampFactor;
      }
      
      // Pair 2-3
      if (abs(waveSteepness[2]) > 0.05 && abs(waveSteepness[3]) > 0.05) {
        float rawInteraction = waveSteepness[2] * waveSteepness[3];
        float scale = 0.00003;
        float dampFactor = 1.0 / (1.0 + abs(rawInteraction) * 10.0);
        interferenceForce += rawInteraction * scale * dampFactor;
      }
    }
  }
  
  // Global damping based on overall wave activity
  interferenceForce *= 1.0 / (1.0 + avgSteepness * 2.0);
}



  
  // Apply interference
  totalRippleInfluence += interferenceForce;
  
  // Apply edge falloff
  totalRippleInfluence = totalRippleInfluence * topFalloff * bottomFalloff * u_ripple_active;



// Advanced smoothing for high amplitude areas
if (abs(totalRippleInfluence) > 10.0) {
  float sign = totalRippleInfluence > 0.0 ? 1.0 : -1.0;
  float baseValue = 10.0 * sign;
  float excess = abs(totalRippleInfluence) - 10.0;
  
  // Gaussian-inspired falloff for peak smoothing
  float gaussianFactor = exp(-excess * excess * 0.01);
  float smoothedExcess = excess * (0.7 + 0.3 * gaussianFactor);
  
  totalRippleInfluence = baseValue + smoothedExcess * sign;
}




  // Final displacement value for vertex position and fragment shader
  v_displacement = totalRippleInfluence;
  
  // Optimized normal calculation - only compute detailed normals when needed
  vec3 normal = vec3(0.0, 0.0, 1.0); // Default normal pointing up
  
  // Only calculate complex normals if displacement is significant
  if (abs(totalRippleInfluence) > 0.001) {
    // Normal strength factor - precomputed
    float normalStrength = 0.02;
    float smoothingFactor = 0.7;
    
    // Base normal calculation from wave gradient
    normal.x = -finalSteepness * normalStrength * smoothingFactor;
    
    // Add direction-based tilting only for significant wave steepness
    if (abs(finalSteepness) > 0.1) {
      for (int i = 0; i < 4; i++) {
        if (i >= u_active_ripples || abs(waveSteepness[i]) < 0.1) continue;
        
        // Get ripple direction - static indexing for each case
        vec2 rippleDir;
        if (i == 0) rippleDir = normalize(uvNorm.xy - u_ripple_point0);
        else if (i == 1) rippleDir = normalize(uvNorm.xy - u_ripple_point1);
        else if (i == 2) rippleDir = normalize(uvNorm.xy - u_ripple_point2);
        else rippleDir = normalize(uvNorm.xy - u_ripple_point3);
        
        // Direction-based tilt factor
        float dirFactor = waveSteepness[i] * normalStrength * 0.5;
        normal.x += rippleDir.x * dirFactor;
        normal.y += rippleDir.y * dirFactor;
      }
    }
    
    // Normalize once at the end
    normal = normalize(normal);
  }
  
  // Simplified lighting calculation
  // Light direction (from upper right, slightly in front)
  vec3 lightDir = normalize(vec3(0.5, 0.5, 0.6));
  vec3 viewDir = vec3(0.0, 0.0, 1.0); // Looking straight at the surface
  vec3 halfVec = normalize(lightDir + viewDir);
  
  float specularPower = 24.0;
  float specular = pow(max(dot(normal, halfVec), 0.0), specularPower);
  
  // Add conditional specular enhancements with threshold checks
  if (totalRippleInfluence > 3.0) {
    specular *= 2.0;
  }
  
  if (abs(interferenceForce) > 0.05) {
    specular *= (1.0 + abs(interferenceForce) * 10.0);
  }



// Progressive smoothing based on amplitude
float displacementFactor = 1.0;
if (abs(v_displacement) > 0.0) {
  // Start with full strength for normal displacements
  displacementFactor = 1.0;
  
  // Apply progressive reduction for higher amplitudes
  if (abs(v_displacement) > 5.0) {
    float excess = abs(v_displacement) - 5.0;
    displacementFactor = 1.0 - smoothstep(0.0, 20.0, excess) * 0.3;
  }
  
  // Apply even stronger reduction for very high amplitudes
  if (abs(v_displacement) > 15.0) {
    float superExcess = abs(v_displacement) - 15.0;
    displacementFactor -= smoothstep(0.0, 10.0, superExcess) * 0.3;
  }
}

// Apply adjusted displacement
v_displacement *= displacementFactor;



  
  // Apply displacement to vertex position
  vec3 pos = vec3(
    position.x,
    position.z + v_displacement,
    position.y
  );

  // Base color handling
  if (u_active_colors[0] == 1.) {
    v_color = u_baseColor;
  }

  // Wave layer coloring (unchanged)
  for (int i = 0; i < u_waveLayers_length; i++) {
    if (u_active_colors[i + 1] == 1.) {
      WaveLayers layer = u_waveLayers[i];
      float noise = smoothstep(
        layer.noiseFloor,
        layer.noiseCeil,
        snoise(vec3(
          noiseCoord.x * layer.noiseFreq.x + time * layer.noiseFlow,
          noiseCoord.y * layer.noiseFreq.y,
          time * layer.noiseSpeed + layer.noiseSeed
        )) / 2.0 + 0.5
      );
      v_color = blendNormal(v_color, layer.color, pow(noise, 4.));
    }
  }
  
  // Apply lighting based on displacement - with thresholds to reduce branching
  float lightIntensity = totalRippleInfluence * 0.03;
  
  // Add extra highlights at wave collision points
  if (abs(interferenceForce) > 0.1) {
    lightIntensity += abs(interferenceForce) * 0.1;
  }
  
  // Combine lighting calculations to reduce branches
  if (totalRippleInfluence > 0.0) {
    // Brighten crests 
    v_color = mix(v_color, vec3(1.0, 1.0, 1.0), min(lightIntensity * 2.5, 0.4));
  } 
  else if (totalRippleInfluence < 0.0) {
    // Darken troughs
    v_color = mix(v_color, vec3(0.0, 0.1, 0.2), min(-lightIntensity * 0.25, 0.4));
  }
  
  // Add specular highlights and bloom in one step
  float bloomRadius = 5.0;
  float edgeFade = 1.0 - min(specular / bloomRadius, 1.0);
  v_color = v_color + vec3(specular) * 0.7 + vec3(0.7, 0.7, 1.0) * edgeFade * specular * 0.4;

  // Final position
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
            `,
            noise: "//\n// Description : Array and textureless GLSL 2D/3D/4D simplex\n//               noise functions.\n//      Author : Ian McEwan, Ashima Arts.\n//  Maintainer : stegu\n//     Lastmod : 20110822 (ijm)\n//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.\n//               Distributed under the MIT License. See LICENSE file.\n//               https://github.com/ashima/webgl-noise\n//               https://github.com/stegu/webgl-noise\n//\n\nvec3 mod289(vec3 x) {\n  return x - floor(x * (1.0 / 289.0)) * 289.0;\n}\n\nvec4 mod289(vec4 x) {\n  return x - floor(x * (1.0 / 289.0)) * 289.0;\n}\n\nvec4 permute(vec4 x) {\n    return mod289(((x*34.0)+1.0)*x);\n}\n\nvec4 taylorInvSqrt(vec4 r)\n{\n  return 1.79284291400159 - 0.85373472095314 * r;\n}\n\nfloat snoise(vec3 v)\n{\n  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;\n  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);\n\n// First corner\n  vec3 i  = floor(v + dot(v, C.yyy) );\n  vec3 x0 =   v - i + dot(i, C.xxx) ;\n\n// Other corners\n  vec3 g = step(x0.yzx, x0.xyz);\n  vec3 l = 1.0 - g;\n  vec3 i1 = min( g.xyz, l.zxy );\n  vec3 i2 = max( g.xyz, l.zxy );\n\n  //   x0 = x0 - 0.0 + 0.0 * C.xxx;\n  //   x1 = x0 - i1  + 1.0 * C.xxx;\n  //   x2 = x0 - i2  + 2.0 * C.xxx;\n  //   x3 = x0 - 1.0 + 3.0 * C.xxx;\n  vec3 x1 = x0 - i1 + C.xxx;\n  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y\n  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y\n\n// Permutations\n  i = mod289(i);\n  vec4 p = permute( permute( permute(\n            i.z + vec4(0.0, i1.z, i2.z, 1.0 ))\n          + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))\n          + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));\n\n// Gradients: 7x7 points over a square, mapped onto an octahedron.\n// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)\n  float n_ = 0.142857142857; // 1.0/7.0\n  vec3  ns = n_ * D.wyz - D.xzx;\n\n  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)\n\n  vec4 x_ = floor(j * ns.z);\n  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)\n\n  vec4 x = x_ *ns.x + ns.yyyy;\n  vec4 y = y_ *ns.x + ns.yyyy;\n  vec4 h = 1.0 - abs(x) - abs(y);\n\n  vec4 b0 = vec4( x.xy, y.xy );\n  vec4 b1 = vec4( x.zw, y.zw );\n\n  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;\n  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;\n  vec4 s0 = floor(b0)*2.0 + 1.0;\n  vec4 s1 = floor(b1)*2.0 + 1.0;\n  vec4 sh = -step(h, vec4(0.0));\n\n  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;\n  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;\n\n  vec3 p0 = vec3(a0.xy,h.x);\n  vec3 p1 = vec3(a0.zw,h.y);\n  vec3 p2 = vec3(a1.xy,h.z);\n  vec3 p3 = vec3(a1.zw,h.w);\n\n//Normalise gradients\n  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));\n  p0 *= norm.x;\n  p1 *= norm.y;\n  p2 *= norm.z;\n  p3 *= norm.w;\n\n// Mix final noise value\n  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);\n  m = m * m;\n  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),\n                                dot(p2,x2), dot(p3,x3) ) );\n}",
            blend: "//\n// https://github.com/jamieowen/glsl-blend\n//\n\n// Normal\n\nvec3 blendNormal(vec3 base, vec3 blend) {\n\treturn blend;\n}\n\nvec3 blendNormal(vec3 base, vec3 blend, float opacity) {\n\treturn (blendNormal(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Screen\n\nfloat blendScreen(float base, float blend) {\n\treturn 1.0-((1.0-base)*(1.0-blend));\n}\n\nvec3 blendScreen(vec3 base, vec3 blend) {\n\treturn vec3(blendScreen(base.r,blend.r),blendScreen(base.g,blend.g),blendScreen(base.b,blend.b));\n}\n\nvec3 blendScreen(vec3 base, vec3 blend, float opacity) {\n\treturn (blendScreen(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Multiply\n\nvec3 blendMultiply(vec3 base, vec3 blend) {\n\treturn base*blend;\n}\n\nvec3 blendMultiply(vec3 base, vec3 blend, float opacity) {\n\treturn (blendMultiply(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Overlay\n\nfloat blendOverlay(float base, float blend) {\n\treturn base<0.5?(2.0*base*blend):(1.0-2.0*(1.0-base)*(1.0-blend));\n}\n\nvec3 blendOverlay(vec3 base, vec3 blend) {\n\treturn vec3(blendOverlay(base.r,blend.r),blendOverlay(base.g,blend.g),blendOverlay(base.b,blend.b));\n}\n\nvec3 blendOverlay(vec3 base, vec3 blend, float opacity) {\n\treturn (blendOverlay(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Hard light\n\nvec3 blendHardLight(vec3 base, vec3 blend) {\n\treturn blendOverlay(blend,base);\n}\n\nvec3 blendHardLight(vec3 base, vec3 blend, float opacity) {\n\treturn (blendHardLight(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Soft light\n\nfloat blendSoftLight(float base, float blend) {\n\treturn (blend<0.5)?(2.0*base*blend+base*base*(1.0-2.0*blend)):(sqrt(base)*(2.0*blend-1.0)+2.0*base*(1.0-blend));\n}\n\nvec3 blendSoftLight(vec3 base, vec3 blend) {\n\treturn vec3(blendSoftLight(base.r,blend.r),blendSoftLight(base.g,blend.g),blendSoftLight(base.b,blend.b));\n}\n\nvec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {\n\treturn (blendSoftLight(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Color dodge\n\nfloat blendColorDodge(float base, float blend) {\n\treturn (blend==1.0)?blend:min(base/(1.0-blend),1.0);\n}\n\nvec3 blendColorDodge(vec3 base, vec3 blend) {\n\treturn vec3(blendColorDodge(base.r,blend.r),blendColorDodge(base.g,blend.g),blendColorDodge(base.b,blend.b));\n}\n\nvec3 blendColorDodge(vec3 base, vec3 blend, float opacity) {\n\treturn (blendColorDodge(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Color burn\n\nfloat blendColorBurn(float base, float blend) {\n\treturn (blend==0.0)?blend:max((1.0-((1.0-base)/blend)),0.0);\n}\n\nvec3 blendColorBurn(vec3 base, vec3 blend) {\n\treturn vec3(blendColorBurn(base.r,blend.r),blendColorBurn(base.g,blend.g),blendColorBurn(base.b,blend.b));\n}\n\nvec3 blendColorBurn(vec3 base, vec3 blend, float opacity) {\n\treturn (blendColorBurn(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Vivid Light\n\nfloat blendVividLight(float base, float blend) {\n\treturn (blend<0.5)?blendColorBurn(base,(2.0*blend)):blendColorDodge(base,(2.0*(blend-0.5)));\n}\n\nvec3 blendVividLight(vec3 base, vec3 blend) {\n\treturn vec3(blendVividLight(base.r,blend.r),blendVividLight(base.g,blend.g),blendVividLight(base.b,blend.b));\n}\n\nvec3 blendVividLight(vec3 base, vec3 blend, float opacity) {\n\treturn (blendVividLight(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Lighten\n\nfloat blendLighten(float base, float blend) {\n\treturn max(blend,base);\n}\n\nvec3 blendLighten(vec3 base, vec3 blend) {\n\treturn vec3(blendLighten(base.r,blend.r),blendLighten(base.g,blend.g),blendLighten(base.b,blend.b));\n}\n\nvec3 blendLighten(vec3 base, vec3 blend, float opacity) {\n\treturn (blendLighten(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Linear burn\n\nfloat blendLinearBurn(float base, float blend) {\n\t// Note : Same implementation as BlendSubtractf\n\treturn max(base+blend-1.0,0.0);\n}\n\nvec3 blendLinearBurn(vec3 base, vec3 blend) {\n\t// Note : Same implementation as BlendSubtract\n\treturn max(base+blend-vec3(1.0),vec3(0.0));\n}\n\nvec3 blendLinearBurn(vec3 base, vec3 blend, float opacity) {\n\treturn (blendLinearBurn(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Linear dodge\n\nfloat blendLinearDodge(float base, float blend) {\n\t// Note : Same implementation as BlendAddf\n\treturn min(base+blend,1.0);\n}\n\nvec3 blendLinearDodge(vec3 base, vec3 blend) {\n\t// Note : Same implementation as BlendAdd\n\treturn min(base+blend,vec3(1.0));\n}\n\nvec3 blendLinearDodge(vec3 base, vec3 blend, float opacity) {\n\treturn (blendLinearDodge(base, blend) * opacity + base * (1.0 - opacity));\n}\n\n// Linear light\n\nfloat blendLinearLight(float base, float blend) {\n\treturn blend<0.5?blendLinearBurn(base,(2.0*blend)):blendLinearDodge(base,(2.0*(blend-0.5)));\n}\n\nvec3 blendLinearLight(vec3 base, vec3 blend) {\n\treturn vec3(blendLinearLight(base.r,blend.r),blendLinearLight(base.g,blend.g),blendLinearLight(base.b,blend.b));\n}\n\nvec3 blendLinearLight(vec3 base, vec3 blend, float opacity) {\n\treturn (blendLinearLight(base, blend) * opacity + base * (1.0 - opacity));\n}",
            fragment: "varying vec3 v_color;\n\nvoid main() {\n  vec3 color = v_color;\n  if (u_darken_top == 1.0) {\n    vec2 st = gl_FragCoord.xy/resolution.xy;\n   color.g -= pow(st.y + sin(-12.0) * st.x, u_shadow_power) * 0.4;\n  }\n  gl_FragColor = vec4(color, 1.0);\n}"
        },
        this.conf = {
            presetName: "",
            wireframe: false,
            density: [.24, .24],
            zoom: 1,
            rotation: 2,
            playing: true
        }, 
        document.querySelectorAll("canvas").length < 1 ? console.log("DID NOT LOAD CANVAS") : (
          
          this.minigl = new MiniGl(this.el, null, null, !0), 
          requestAnimationFrame(() => {
              this.el && (this.computedCanvasStyle = getComputedStyle(this.el), this.waitForCssVars())
          })
          
  
        )

        if (!this.minigl) {
            // Create WebGL context only when needed
            this.minigl = new MiniGl(this.el, this.width, this.height, false);
            this.initGradientColors();
            this.initMesh();
          }
          
          this.resize();
          requestAnimationFrame(this.animate);
          window.addEventListener('resize', this.resize);
          return this;
    }
    disconnect() {
        this.scrollObserver && (window.removeEventListener("scroll", this.handleScroll), window.removeEventListener("mousedown", this.handleMouseDown), window.removeEventListener("mouseup", this.handleMouseUp), window.removeEventListener("keydown", this.handleKeyDown), this.scrollObserver.disconnect()), window.removeEventListener("resize", this.resize)
    }
    initMaterial() {
        this.uniforms = {
            u_mouse: new this.minigl.Uniform({
                value: this.mouse,
                type: "vec2"
            }),
            u_ripple_point0: new this.minigl.Uniform({
                value: [0.0, 0.0],
                type: "vec2"
            }),
            u_ripple_point1: new this.minigl.Uniform({
                value: [0.0, 0.0],
                type: "vec2"
            }),
            u_ripple_point2: new this.minigl.Uniform({
                value: [0.0, 0.0],
                type: "vec2"
            }),
            u_ripple_point3: new this.minigl.Uniform({
                value: [0.0, 0.0],
                type: "vec2"
            }),
            u_ripple_time0: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),
            u_ripple_time1: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),
            u_ripple_time2: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),
            u_ripple_time3: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),
            u_mouse_velocity0: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),
            u_mouse_velocity1: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),
            u_mouse_velocity2: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),
            u_mouse_velocity3: new this.minigl.Uniform({
                value: 0.0,
                type: "float"
            }),            
            u_active_ripples: new this.minigl.Uniform({
                value: 0,
                type: "int"
            }),
            u_ripple_active: new this.minigl.Uniform({
                value: 0,  // 0 = inactive, 1 = active
                type: "float"
            }),                
            u_aspect_ratio: new this.minigl.Uniform({
                value: this.width / this.height,
                type: "float"
            }),
            u_time: new this.minigl.Uniform({
                value: 0
            }),
            u_shadow_power: new this.minigl.Uniform({
                value: 10
            }),
            u_darken_top: new this.minigl.Uniform({
                value: "" === this.el.dataset.jsDarkenTop ? 1 : 0
            }),
            u_active_colors: new this.minigl.Uniform({
                value: this.activeColors,
                type: "vec4"
            }),
            u_global: new this.minigl.Uniform({
                value: {
                    noiseFreq: new this.minigl.Uniform({
                        value: [this.freqX, this.freqY],
                        type: "vec2"
                    }),
                    noiseSpeed: new this.minigl.Uniform({
                        value: 5e-6
                    })
                },
                type: "struct"
            }),
            u_vertDeform: new this.minigl.Uniform({
                value: {
                    incline: new this.minigl.Uniform({
                        value: Math.sin(this.angle) / Math.cos(this.angle)
                    }),
                    offsetTop: new this.minigl.Uniform({
                        value: -.5
                    }),
                    offsetBottom: new this.minigl.Uniform({
                        value: -.5
                    }),
                    noiseFreq: new this.minigl.Uniform({
                        value: [7, 20],
                        type: "vec2"
                    }),
                    noiseAmp: new this.minigl.Uniform({
                        value: this.amp
                    }),
                    noiseSpeed: new this.minigl.Uniform({
                        value: 3
                    }),
                    noiseFlow: new this.minigl.Uniform({
                        value: -3
                    }),
                    noiseSeed: new this.minigl.Uniform({
                        value: this.seed
                    })
                },
                type: "struct",
                excludeFrom: "fragment"
            }),
            u_baseColor: new this.minigl.Uniform({
                value: this.sectionColors[0],
                type: "vec3",
                excludeFrom: "fragment"
            }),
            u_waveLayers: new this.minigl.Uniform({
                value: [],
                excludeFrom: "fragment",
                type: "array"
            })
        };
        for (let e = 1; e < this.sectionColors.length; e += 1) this.uniforms.u_waveLayers.value.push(new this.minigl.Uniform({
            value: {
                color: new this.minigl.Uniform({
                    value: this.sectionColors[e],
                    type: "vec3"
                }),
                noiseFreq: new this.minigl.Uniform({
                    value: [2 + e / this.sectionColors.length, 2 + e / this.sectionColors.length],
                    type: "vec2"
                }),
                noiseSpeed: new this.minigl.Uniform({
                    value: 11 + .3 * e
                }),
                noiseFlow: new this.minigl.Uniform({
                    value: 1.5 + .3 * e
                }),
                noiseSeed: new this.minigl.Uniform({
                    value: this.seed + 10 * e
                }),
                noiseFloor: new this.minigl.Uniform({
                    value: .1
                }),
                noiseCeil: new this.minigl.Uniform({
                    value: .63 + .07 * e
                })
            },
            type: "struct"
        }));
        return this.vertexShader = [this.shaderFiles.noise, this.shaderFiles.blend, this.shaderFiles.vertex].join("\n\n"), new this.minigl.Material(this.vertexShader, this.shaderFiles.fragment, this.uniforms)
    }
    initMesh() {
        this.material = this.initMaterial(), this.geometry = new this.minigl.PlaneGeometry, this.mesh = new this.minigl.Mesh(this.geometry, this.material)
    }
    shouldSkipFrame(e) {
        return !!window.document.hidden || (!this.conf.playing || (parseInt(e, 10) % 2 == 0 || void 0))
    }
    updateFrequency(e) {
        this.freqX += e, this.freqY += e
    }
    toggleColor(index) {
        this.activeColors[index] = 0 === this.activeColors[index] ? 1 : 0
    }
    showGradientLegend() {
        this.width > this.minWidth && (this.isGradientLegendVisible = !0, document.body.classList.add("isGradientLegendVisible"))
    }
    hideGradientLegend() {
        this.isGradientLegendVisible = !1, document.body.classList.remove("isGradientLegendVisible")
    }
    init() {
        this.initGradientColors(), this.initMesh(), this.resize(), requestAnimationFrame(this.animate), window.addEventListener("resize", this.resize)
    }
    /*
    * Waiting for the css variables to become available, usually on page load before we can continue.
    * Using default colors assigned below if no variables have been found after maxCssVarRetries
    */
    waitForCssVars() {
        if (this.computedCanvasStyle && -1 !== this.computedCanvasStyle.getPropertyValue("--gradient-color-1").indexOf("#")) this.init(), this.addIsLoadedClass();
        else {
            if (this.cssVarRetries += 1, this.cssVarRetries > this.maxCssVarRetries) {
                return this.sectionColors = [16711680, 16711680, 16711935, 65280, 255],void this.init();
            }
            requestAnimationFrame(() => this.waitForCssVars())
        }
    }
    /*
    * Initializes the four section colors by retrieving them from css variables.
    */
    initGradientColors() {
        this.sectionColors = ["--gradient-color-1", "--gradient-color-2", "--gradient-color-3", "--gradient-color-4"].map(cssPropertyName => {
            let hex = this.computedCanvasStyle.getPropertyValue(cssPropertyName).trim();
            //Check if shorthand hex value was used and double the length so the conversion in normalizeColor will work.
            if (4 === hex.length) {
                const hexTemp = hex.substr(1).split("").map(hexTemp => hexTemp + hexTemp).join("");
                hex = `#${hexTemp}`
            }
            return hex && `0x${hex.substr(1)}`
        }).filter(Boolean).map(normalizeColor)
    }
    onMouseMove(event) {
        // Throttle mouse movement processing
        if (!this._throttleMouseMove) {
            this._throttleMouseMove = true;
            
            setTimeout(() => {
            const rect = this.el.getBoundingClientRect();
            
            // Store last position
            this.lastMousePos = [...this.mouse];
            
            // Update current position
            this.mouse[0] = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse[1] = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Calculate velocity
            const dx = this.mouse[0] - this.lastMousePos[0];
            const dy = this.mouse[1] - this.lastMousePos[1];
            this.mouseVelocity = Math.sqrt(dx*dx + dy*dy);
            
            if(Number.isNaN(this.mouseVelocity))
                this.mouseVelocity = 0;
            
            // Activate ripples if not already active
            if (this.uniforms.u_ripple_active.value !== 1) {
                this.uniforms.u_ripple_active.value = 1;
            }
            
            this._throttleMouseMove = false;
            }, 16); // ~60fps update rate
        }
        
        // Check if we should create a new ripple
        const currentTime = Date.now();
        if (currentTime - this.lastRippleTime >= this.rippleThrottleInterval) {
            this.lastRippleTime = currentTime;
            
            // Require minimum movement to create ripple
            if (this.mouseVelocity > 0.001) {
            // Shift ripple data (reuse existing arrays)
            this.uniforms.u_ripple_point3.value[0] = this.uniforms.u_ripple_point2.value[0];
            this.uniforms.u_ripple_point3.value[1] = this.uniforms.u_ripple_point2.value[1];
            this.uniforms.u_ripple_time3.value = this.uniforms.u_ripple_time2.value;
            this.uniforms.u_mouse_velocity3.value = this.uniforms.u_mouse_velocity2.value;
            
            this.uniforms.u_ripple_point2.value[0] = this.uniforms.u_ripple_point1.value[0];
            this.uniforms.u_ripple_point2.value[1] = this.uniforms.u_ripple_point1.value[1];
            this.uniforms.u_ripple_time2.value = this.uniforms.u_ripple_time1.value;
            this.uniforms.u_mouse_velocity2.value = this.uniforms.u_mouse_velocity1.value;
            
            this.uniforms.u_ripple_point1.value[0] = this.uniforms.u_ripple_point0.value[0];
            this.uniforms.u_ripple_point1.value[1] = this.uniforms.u_ripple_point0.value[1];
            this.uniforms.u_ripple_time1.value = this.uniforms.u_ripple_time0.value;
            this.uniforms.u_mouse_velocity1.value = this.uniforms.u_mouse_velocity0.value;
            
            // Set newest ripple
            this.uniforms.u_ripple_point0.value[0] = this.mouse[0];
            this.uniforms.u_ripple_point0.value[1] = this.mouse[1];
            this.uniforms.u_ripple_time0.value = this.t;
            this.uniforms.u_mouse_velocity0.value = Math.min(this.mouseVelocity * 50.0, 1.0);
            
            // Update active ripples count
            this.uniforms.u_active_ripples.value = Math.min(this.uniforms.u_active_ripples.value + 1, 4);
            
            // Ensure animation is running
            if (!this.conf.playing && !this.isMouseDown) {
                this.play();
            }
            }
        }
        

    }    
    
  }
