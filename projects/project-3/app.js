import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from '../../libs/utils.js';
import { length, flatten, inverse, mult, normalMatrix, perspective, lookAt, vec4, vec3, vec2, subtract, add, scale, rotate, normalize } from '../../libs/MV.js';
import {modelView, loadMatrix, multRotationY, multScale, multTranslation, popMatrix, pushMatrix} from "../../libs/stack.js";

import * as dat from '../../libs/dat.gui.module.js';

import * as CUBE from '../../libs/cube.js';
import * as SPHERE from '../../libs/sphere.js';
import * as TORUS from '../../libs/torus.js';

import * as STACK from '../../libs/stack.js';

class Shape {

    constructor(type) {
        this.type = type;
        this.position = vec3(0, 0, 0);
        this.ka = vec3(255, 255, 255);
        this.kd = vec3(255, 255, 255);
        this.ks = vec3(255, 255, 255);
        this.shininess = 50.0;
    }

}

class Light {

    constructor() {
        this.position = vec(0, 0, 0);
        
    }

}

function setup(shaders) {
    const canvas = document.getElementById('gl-canvas');
    const gl = setupWebGL(canvas);

    CUBE.init(gl);
    SPHERE.init(gl);

    const program = buildProgramFromSources(gl, shaders['shader.vert'], shaders['shader.frag']);

    // Camera  
    let camera = {
        eye: vec3(0,0,5),
        at: vec3(0,0,0),
        up: vec3(0,1,0),
        fovy: 45,
        aspect: 1, // Updated further down
        near: 0.1,
        far: 20
    }

    let options = {
        backfaceculling: false,
        depthtest: false,
        showlights: false,
        normals: true
    }

    let light = {
        position : vec3(0,0,0),
        ambient: 75,
        diffuse: 175,
        specular:225,
        directional: false,
        active: true
    }

    let shapes = new Map();
    let selectedShape = "cube1";

    const controlsGUI = new dat.GUI();
    
    const optionsFolder = controlsGUI.addFolder("options");

    optionsFolder.add(options, "backfaceculling").name("backface culling").onChange(()=> {
        options.backfaceculling ? gl.enable(gl.CULL_FACE) : gl.disable(gl.CULL_FACE);
    });

    optionsFolder.add(options, "depthtest").name("depth test").onChange(()=> {
        options.depthtest? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST);
    });

    optionsFolder.add(options, "showlights").name("show lights");

    const cameraFolder = controlsGUI.addFolder("camera");

    cameraFolder.add(camera, "fovy").min(1).max(100).step(1).listen();
    //cameraGui.add(camera, "aspect").min(0).max(10).listen().domElement.style.pointerEvents = "none";
    
    cameraFolder.add(camera, "near").min(0.1).max(20).onChange( function(v) {
        camera.near = Math.min(camera.far-0.5, v);
    });

    cameraFolder.add(camera, "far").min(0.1).max(20).listen().onChange( function(v) {
        camera.far = Math.max(camera.near+0.5, v);
    });

    const eyeFolder = cameraFolder.addFolder("eye");

    eyeFolder.add(camera.eye, 0).step(0.05).name("x");//.domElement.style.pointerEvents = "none";;
    eyeFolder.add(camera.eye, 1).step(0.05).name("y");//.domElement.style.pointerEvents = "none";;
    eyeFolder.add(camera.eye, 2).step(0.05).name("z");//.domElement.style.pointerEvents = "none";;

    const atFolder = cameraFolder.addFolder("at");

    atFolder.add(camera.at, 0).step(0.05).name("x");//.domElement.style.pointerEvents = "none";;
    atFolder.add(camera.at, 1).step(0.05).name("y");//.domElement.style.pointerEvents = "none";;
    atFolder.add(camera.at, 2).step(0.05).name("z");//.domElement.style.pointerEvents = "none";;

    const upFolder = cameraFolder.addFolder("up");

    upFolder.add(camera.up, 0).step(0.05).name("x");//.domElement.style.pointerEvents = "none";;
    upFolder.add(camera.up, 1).step(0.05).name("y");//.domElement.style.pointerEvents = "none";;
    upFolder.add(camera.up, 2).step(0.05).name("z");//.domElement.style.pointerEvents = "none";;

    const lightFolder = controlsGUI.addFolder("light");

    const positionFolder = lightFolder.addFolder("position");

    positionFolder.add(light.position, 0).step(0.05).name("x");
    positionFolder.add(light.position, 1).step(0.05).name("y");
    positionFolder.add(light.position, 2).step(0.05).name("z");

    lightFolder.add(light, "ambient").min(0.1).max(75);
    lightFolder.add(light,"diffuse").min(0.1).max(175);
    lightFolder.add(light,"specular").min(0.1).max(255);

    lightFolder.add(light, "directional");
    lightFolder.add(light, "active");

    const objectsGUI = new dat.GUI();

    const materialFolder = objectsGUI.addFolder("material");

   // materialFolder.add(selectedObjectIndex, "object");


    // matrices
    let mView, mProjection;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //options.depthtest?gl.enable(gl.DEPTH_TEST): gl.disable(gl.DEPTH_TEST);

    resizeCanvasToFullWindow();

    window.addEventListener('resize', resizeCanvasToFullWindow);

    window.addEventListener('wheel', function(event) {
        const factor = 1 - event.deltaY/1000;
        camera.fovy = Math.max(1, Math.min(100, camera.fovy * factor)); 
    });


    window.requestAnimationFrame(render);

    function resizeCanvasToFullWindow()
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        camera.aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function render(time)
    {
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        mView = lookAt(camera.eye, camera.at, camera.up);
        STACK.loadMatrix(mView);

        mProjection = perspective(camera.fovy, camera.aspect, camera.near, camera.far);


        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(STACK.modelView()));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mNormals"), false, flatten(normalMatrix(STACK.modelView())));

        gl.uniform1i(gl.getUniformLocation(program, "uUseNormals"), options.normals);

        //SPHERE.draw(gl, program, options.wireframe ? gl.LINES : gl.TRIANGLES);
       // CUBE.draw(gl, program, gl.LINES);

        //DESENHAR UM CUBO DEFORMADO NUM PARALELEPIPEDO COM AS DIMENSOES DE 3 X 0.1 X 3 TRANSFORMADO DE FORMA A QUE A FACE SUPERIOR FIQUE EM Y=-0.5
          //////////////////
        pushMatrix();   
        multTranslation([0,-.7,0]);
        multScale([3,0.1,3]);
        uploadModelView();
        CUBE.draw(gl, program, gl.TRIANGLES);
        popMatrix();
          /////////////////
        
          //OBJECTO ELEMENTAR  - NESTE CASO UMA ESFERA
        pushMatrix();
        uploadModelView();
        CUBE.draw(gl, program, gl.TRIANGLES);
        popMatrix();

        //LUZ - NAO SEI COMO LIGAR ISTO A OPCAO SHOW LIGHTS DENTRO DO INTERFACE
        pushMatrix();
        multTranslation(light.position);
        multScale([0.1,0.1,-0.1]);
        uploadModelView();
        SPHERE.draw(gl, program, gl.TRIANGLES);
        popMatrix();
    }
}

const urls = ['shader.vert', 'shader.frag'];

loadShadersFromURLS(urls).then( shaders => setup(shaders));