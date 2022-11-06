class XCard extends HTMLElement {
    constructor() {
        super();

        addSignal(this,
            'ready',
            'newInstance',
        );
    }

    main() {
        return asyn(()=> {
            const canvasElem = this.gencQuerySelector("div#render canvas");

            const scene = new THREE.Scene();
            scene.background = new THREE.Color( 0xffffff );

            const camera = new THREE.PerspectiveCamera( 75, canvasElem.getBoundingClientRect().width / canvasElem.getBoundingClientRect().height, 0.1, 1000 );
            camera.position.z = 7;

            const renderer = new THREE.WebGLRenderer({canvas: canvasElem, antialias: true});
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.toneMapping = THREE.ReinhardToneMapping;
            renderer.toneMappingExposure = 2.3;
            renderer.shadowMap.enabled = true;

            const orbit = new THREE.OrbitControls(camera, renderer.domElement);

            const hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 4);
            scene.add(hemiLight);
            const spotLight = new THREE.SpotLight(0xffffff, 6);
            spotLight.castShadow = true;
            spotLight.shadow.bias = -0.0001;
            spotLight.shadow.mapSize.width = 1024*4;
            spotLight.shadow.mapSize.height = 1024*4;
            scene.add(spotLight);


            const loader = new THREE.GLTFLoader();
            loader.load( './components/x-card/assets/shoe3d.glb', function ( gltf ) {
                let model = gltf.scene;
                model.traverse(n => {
                    if(n.isMesh) {
                        n.castShadow = true;
                        n.receiveShadow = true;

                        if(n.material.map)
                            n.material.map.anisotropy = 16;
                    }
                });
                scene.add(model);

                function animate() {
                    requestAnimationFrame( animate );

                    spotLight.position.set(
                        camera.position.x +10,
                        camera.position.y +10,
                        camera.position.z +10
                    );

                    model.rotation.y += 0.01;
                    
                    orbit.update();
                    renderer.render( scene, camera );
                }
                animate();
            }, undefined, function ( error ) {
                console.error( error );
            } );

            const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(100, 100),
                new THREE.MeshLambertMaterial({
                    side: THREE.DoubleSide,
                })
            );
            plane.material.color.setHex(0xffffff);
            plane.rotateX(-Math.PI / 2);
            plane.position.y = -2;
            plane.castShadow = true;
            plane.receiveShadow = true;
            scene.add(plane);

        });
    }
}

customElements.define('x-card', XCard);