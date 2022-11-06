class GalleryC extends HTMLElement {
    constructor() {
        super();

        addSignal(this,
            'ready',
            'newInstance',
        );
    }

    main() {
        return asyn(()=> {
            console.log("hola soy gallery-c");
        });
    }
}

customElements.define('gallery-c', GalleryC);