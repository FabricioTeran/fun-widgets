/*
Ejemplos:

g-router(gurl="/")
    prueba-a(gurl="main")
    prueba-a(gurl="second")

g-router(gurl="/a")
    prueba-a(gurl="/main")

g-router
    prueba-a(gurl="/main")
    prueba-a(gurl="/second")
*/

//No se puede permitir que el usuario modifique la url manualmente ya que esto refresca la aplicacion. Solo renderizar la pagina default, modificar la barra de busqueda e ir cambiando las paginas y la url de la barra cuando el usuario haga click en enlaces o botones
class GRouter extends HTMLElement {
    constructor() {
        super();

        addSignal(this, 'onPageChange');

        this.pageURLAttribute = "gurl";
        //
        this.urlList = new Map();
        this.gurl = "";

        this.grouterDefaultAttribute = "grouter-default";
        this.grouterSelected = null;
    }

    main() {
        return asyn(() => {
            this.gurl = this.getAttribute(this.pageURLAttribute) !== null?
                        this.getAttribute(this.pageURLAttribute) :
                        "";

            let childs = this.gencQuerySelectorAll(`*[${this.pageURLAttribute}]`);
            let childsArray = Array.from(childs);
            for(let i in childsArray) {
                this.addPage(childsArray[i], childsArray[i].getAttribute(this.pageURLAttribute));
            }

            let defaultPage = this.gencQuerySelector(`*[${this.grouterDefaultAttribute}]`);
            if(defaultPage !== null) {
                this.selectPage(defaultPage);
            }
        });
    }

    //Se va a buscar todos los childs con gurl en bucle y se va a llamar a esta funcion
    addPage(comp, url) {
        this.urlList.set(comp, url);

        comp.style.setProperty("display", "none");
    }
    //Se va a buscar el primer elemento con grouter-default atributo y se lo va a enviar a selectPage, el cual va a establecer this.grouterSelected en el elemento seleccionado
    //Primero va a verificar si el nuevo page seleccionado esta en la lista, si es asi, modifica al anterior selected (con display:none) y modifica al nuevo seleccionado

    selectPage(comp) {
        if(this.urlList.has(comp)) {
            if(this.grouterSelected !== null) {
                this.grouterSelected.style.setProperty("display", "none");
            }

            comp.style.removeProperty("display");
            this.grouterSelected = comp;

            fireSignal(this, "onPageChange");

            window.history.pushState({}, '', this.gurl + this.urlList.get(comp));
        } else {
            console.log("the element isnt added to the router");
        }
    }
}
customElements.define('g-router', GRouter);