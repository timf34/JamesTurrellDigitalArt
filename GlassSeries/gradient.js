// Create a reusable class for gradient light fields
class GradientLightField {
	constructor(options = {}) {
	  // Default options
	  this.options = {
		container: document.getElementById('container') || document.body,
		// No background color since we want only the gradient
		gradientColors: [
		  { position: 0.0, color: '#8B6FC3' },  // Outer edge (deeper purple)
		  { position: 0.5, color: '#C9B6E4' },  // Inner highlight (lighter purple)
		  { position: 1.0, color: '#8B6FC3' }   // Outer edge again (deeper purple)
		],
		// Shape parameters
		aspectRatio: 0.5,     // width/height ratio (portrait orientation)
		verticalStretch: 0.6, // how elongated the central light area is
		horizontalWidth: 0.4, // how wide the central light area is
		feather: 0.4,        // how soft the gradient edges are
		intensity: 1.2,       // brightness multiplier
		...options
	  };
  
	  this.scene = null;
	  this.camera = null;
	  this.renderer = null;
	  this.mesh = null;
	  
	  this.init();
	}
  
	init() {
	  // Create scene
	  this.scene = new THREE.Scene();
	  
	  // Create camera (orthographic for 2D effect)
	  const aspect = window.innerWidth / window.innerHeight;
	  this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
	  this.camera.position.z = 1;
	  
	  // Create renderer with alpha for transparent background
	  this.renderer = new THREE.WebGLRenderer({ 
		antialias: true,
		alpha: true 
	  });
	  this.renderer.setSize(window.innerWidth, window.innerHeight);
	  this.renderer.setClearColor(0x000000, 0); // Transparent background
	  this.options.container.appendChild(this.renderer.domElement);
	  
	  // Create the shader material
	  this.createMaterial();
	  
	  // Create mesh (a simple plane that fills the screen)
	  const geometry = new THREE.PlaneGeometry(2 * aspect, 2);
	  this.mesh = new THREE.Mesh(geometry, this.material);
	  this.scene.add(this.mesh);
	  
	  // Handle window resize
	  window.addEventListener('resize', this.onResize.bind(this));
	  
	  // Start animation loop
	  this.animate();
	}
	
	createMaterial() {
	  // Convert gradient stops to uniforms
	  const gradientStopsArray = [];
	  this.options.gradientColors.forEach(stop => {
		const rgb = this.hexToRGBNormalized(stop.color);
		gradientStopsArray.push(rgb.r, rgb.g, rgb.b, stop.position);
	  });
	  
	  const numStops = this.options.gradientColors.length;
	  
	  const vertexShader = `
		varying vec2 vUv;
		
		void main() {
		  vUv = uv;
		  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	  `;
	  
	  const fragmentShader = `
		varying vec2 vUv;
		uniform float uIntensity;
		uniform float uVerticalStretch;
		uniform float uHorizontalWidth;
		uniform float uFeather;
		uniform float uAspectRatio;
		
		// Define gradient stops array
		const int numStops = ${numStops};
		uniform vec4 uGradientStops[${numStops}];
		
		void main() {
		  // Center and normalize coordinates
		  vec2 center = vec2(0.5, 0.5);
		  vec2 uv = vUv - center;
		  
		  // Apply aspect ratio adjustment to create correct oval shape
		  uv.x *= uAspectRatio;
		  
		  // Calculate stretched distance field (elliptical)
		  float verticalFactor = uv.y / uVerticalStretch;
		  float horizontalFactor = uv.x / uHorizontalWidth;
		  
		  // Create a distance field that's more like an elongated oval
		  float dist = sqrt(horizontalFactor * horizontalFactor + verticalFactor * verticalFactor);
		  
		  // Soften the gradient with feathering
		  dist = smoothstep(0.0, 1.0 + uFeather, dist);
		  
		  // Find the right gradient color using the distance
		  vec3 color = vec3(0.0);
		  for(int i = 0; i < numStops - 1; i++) {
			if(dist >= uGradientStops[i].w && dist <= uGradientStops[i+1].w) {
			  float t = (dist - uGradientStops[i].w) / (uGradientStops[i+1].w - uGradientStops[i].w);
			  color = mix(uGradientStops[i].xyz, uGradientStops[i+1].xyz, t);
			  break;
			}
		  }
		  
		  // Handle edge cases
		  if(dist < uGradientStops[0].w) {
			color = uGradientStops[0].xyz;
		  } else if(dist > uGradientStops[numStops-1].w) {
			color = uGradientStops[numStops-1].xyz;
		  }
		  
		  // Apply intensity
		  color *= uIntensity;
		  
		  gl_FragColor = vec4(color, 1.0);
		}
	  `;
	  
	  this.material = new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader,
		transparent: true,
		uniforms: {
		  uIntensity: { value: this.options.intensity },
		  uVerticalStretch: { value: this.options.verticalStretch },
		  uHorizontalWidth: { value: this.options.horizontalWidth },
		  uFeather: { value: this.options.feather },
		  uAspectRatio: { value: this.options.aspectRatio },
		  uGradientStops: { value: gradientStopsArray }
		}
	  });
	}
	
	// Helper function to convert hex color to normalized RGB object
	hexToRGBNormalized(hex) {
	  return {
		r: parseInt(hex.slice(1, 3), 16) / 255,
		g: parseInt(hex.slice(3, 5), 16) / 255,
		b: parseInt(hex.slice(5, 7), 16) / 255
	  };
	}
	
	onResize() {
	  const aspect = window.innerWidth / window.innerHeight;
	  
	  // Update camera
	  this.camera.left = -aspect;
	  this.camera.right = aspect;
	  this.camera.updateProjectionMatrix();
	  
	  // Update mesh size
	  this.mesh.geometry.dispose();
	  this.mesh.geometry = new THREE.PlaneGeometry(2 * aspect, 2);
	  
	  // Update renderer
	  this.renderer.setSize(window.innerWidth, window.innerHeight);
	}
	
	animate() {
	  requestAnimationFrame(this.animate.bind(this));
	  this.renderer.render(this.scene, this.camera);
	}
	
	// Public methods to modify the gradient
	updateColors(gradientColors) {
	  this.options.gradientColors = gradientColors;
	  this.createMaterial();
	  this.mesh.material = this.material;
	}
	
	updateShape(params) {
	  // Update shape parameters
	  if (params.aspectRatio !== undefined) {
		this.options.aspectRatio = params.aspectRatio;
		this.material.uniforms.uAspectRatio.value = params.aspectRatio;
	  }
	  
	  if (params.verticalStretch !== undefined) {
		this.options.verticalStretch = params.verticalStretch;
		this.material.uniforms.uVerticalStretch.value = params.verticalStretch;
	  }
	  
	  if (params.horizontalWidth !== undefined) {
		this.options.horizontalWidth = params.horizontalWidth;
		this.material.uniforms.uHorizontalWidth.value = params.horizontalWidth;
	  }
	  
	  if (params.feather !== undefined) {
		this.options.feather = params.feather;
		this.material.uniforms.uFeather.value = params.feather;
	  }
	  
	  if (params.intensity !== undefined) {
		this.options.intensity = params.intensity;
		this.material.uniforms.uIntensity.value = params.intensity;
	  }
	}
  }
  
  // Create the gradient when the page loads
  document.addEventListener('DOMContentLoaded', () => {
	// Create the gradient with purple colors like in the example
	const gradient = new GradientLightField({
	  gradientColors: [
		{ position: 0.0, color: '#8B6FC3' },  // Outer edge (deeper purple)
		{ position: 0.5, color: '#C9B6E4' },  // Inner highlight (lighter purple)
		{ position: 1.0, color: '#8B6FC3' }   // Outer edge again (deeper purple)
	  ],
	  aspectRatio: 0.5,      // Portrait orientation
	  verticalStretch: 0.6,  // Elongated vertically
	  horizontalWidth: 0.4,  // Narrow horizontally
	  feather: 0.4,          // Soft edges
	  intensity: 1.2         // Slightly brighter
	});
	
	// Example functions to create different color schemes
	const createPurpleGradient = () => {
	  gradient.updateColors([
		{ position: 0.0, color: '#8B6FC3' },  // Outer edge (deeper purple)
		{ position: 0.5, color: '#C9B6E4' },  // Inner highlight (lighter purple)
		{ position: 1.0, color: '#8B6FC3' }   // Outer edge again (deeper purple)
	  ]);
	};
	
	const createPinkGradient = () => {
	  gradient.updateColors([
		{ position: 0.0, color: '#FF7BAC' },  // Outer edge (deeper pink)
		{ position: 0.5, color: '#FFB3D1' },  // Inner highlight (lighter pink)
		{ position: 1.0, color: '#FF7BAC' }   // Outer edge again (deeper pink)
	  ]);
	};
	
	const createBlueGradient = () => {
	  gradient.updateColors([
		{ position: 0.0, color: '#5F8DE8' },  // Outer edge (deeper blue)
		{ position: 0.5, color: '#B6D0FF' },  // Inner highlight (lighter blue)
		{ position: 1.0, color: '#5F8DE8' }   // Outer edge again (deeper blue)
	  ]);
	};
	
	// Optionally add UI controls or key handlers to switch between gradients
	document.addEventListener('keydown', (e) => {
	  if (e.key === 'p') createPurpleGradient();
	  if (e.key === 'r') createPinkGradient();
	  if (e.key === 'b') createBlueGradient();
	  
	  // Example for changing shape parameters
	  if (e.key === '1') gradient.updateShape({ verticalStretch: 0.8 }); // More elongated
	  if (e.key === '2') gradient.updateShape({ verticalStretch: 0.4 }); // More circular
	  if (e.key === '3') gradient.updateShape({ horizontalWidth: 0.6 }); // Wider
	  if (e.key === '4') gradient.updateShape({ horizontalWidth: 0.3 }); // Narrower
	});
	
	// Add instructions to the console
	console.log("Gradient Light Field Controls:");
	console.log("- Press 'p' for purple gradient");
	console.log("- Press 'r' for pink gradient");
	console.log("- Press 'b' for blue gradient");
	console.log("- Press '1' for more elongated");
	console.log("- Press '2' for more circular");
	console.log("- Press '3' for wider");
	console.log("- Press '4' for narrower");
  });