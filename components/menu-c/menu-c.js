class MenuC extends HTMLElement {
    constructor() {
        super();

        addSignal(this,
            'ready',
            'newInstance',
        );
    }

    main() {
        return asyn(()=> {
            console.log("hola soy menu-c");
        });
    }
}

customElements.define('menu-c', MenuC);