/*
Simplemente ofrecer una forma mas corta de escribir las querys al shadow dom:

page1.querySelectorGenc("prueba-c::shadow div prueba-b:not(footer prueba-b)::shadow  p > div[web] + footer::after + #id::shadow p");

Tomamos todos los caracteres hasta la coincidencia "::shadow", ejecutamos todo lo que esta detras con un querySelector y luego accedemos al shadowRoot de
la seleccion.

Restricciones: el ::shadow no puede estar adentro de parentesis, no se puede usar *::shadow, ya que no todos los elementos tienen shadowRoot, eso y 
colocar ::shadow a un elemento que no lo tiene causa error, devolviendo null.
*/
HTMLElement.prototype.gencQuerySelector = function(fullSelector) {
    let queries = fullSelector.split('::shadow');
    let target;

    if(!!this.shadowRoot)
        target = this.shadowRoot;
    else
        target = this;

    for(let [i, selector] of queries.entries()) {
        if(selector.trim().length === 0)  //Para los casos en los que termina en ::shadow, luego puede haber una cadena vacia o espacios en blanco o tabuladores, saltos de linea, etc.
            break;

        target = target.querySelector(':scope ' + selector);

        if(target !== null) {
            if(!!target.shadowRoot && (queries.length-1 !== i))  //No se aplica al ultimo elemento del arreglo, ya que los ultimos no tienen ::shadow, y si tuviera, el ultimo elemento es cadena vacia ""
                target = target.shadowRoot;
        }
    }

    return target;
}
HTMLElement.prototype.gencQuerySelectorAll = function(fullSelector) {
    let queries = fullSelector.split('::shadow');
    let targets = [];

    if(!!this.shadowRoot)
        targets.push(this.shadowRoot);
    else
        targets.push(this);

    for(let [index, selector] of queries.entries()) {
        if(selector.trim().length === 0)
            break;

        let newTargets = [];
        for(let tar of targets) {
            tar = Array.from(tar.querySelectorAll(':scope ' + selector)); //SIempre hacer Array.from en querySelectorAll

            for(let i=0; i < tar.length; i++) {
                if(!!tar[i].shadowRoot && (queries.length-1 !== index)) {
                    tar[i] = tar[i].shadowRoot;  //Las nodeLists causan errores extranos como no poder reasignar valores del nodeList, entonces tuve que convertir el nodeList en array con Array.from
                }

                newTargets.push(tar[i]);
            }
        }
        targets = [...newTargets];
    }

    return targets;
}

//WebComponents API
//###################################################################################################################################################################
document.addEventListener("DOMContentLoaded", function () {

    gencEngine.initIdList();

    //Porque los templates se construyen diferente a los genc del body? Porque hemos agregado la opcion de saltarse templates con "genc_shadow" en el deepSearch, por lo que debemos pasar manualmente los templates, ya que de otra forma serian bypasseados
    for(let temp of gencEngine.idList.values()) {
        gencEngine.runTemplateScripts(temp);   
        gencEngine.markSlots(temp.content);
    }
    gencEngine.resolveTemplateDependency(gencEngine.idList);
    for(let temp of gencEngine.idList.values()) {
        gencEngine.moveSlots(temp.content);
    }

    gencEngine.markSlots(document.body);
    gencEngine.replaceInstances(document.body);  //Vuelve a encerrar con el shadowWrap a los slots que son webcomponents
    gencEngine.moveSlots(document.body);
    gencEngine.replaceShadowTemplates(document.body);

    gencEngine.initInstances(document.body);  //No se inicializan las instancias dentro de templates
});



let gencEngine = {
    templateClassName: "genc",
    templateWraperName: "genc_shadow",
    slotAttributeName: "genc_slot",

    idList: 0,
    initIdList: function() {
        let templates = Array.from(document.querySelectorAll(`template.${this.templateClassName}`));

        //Primero mapea los objetos en una matriz parecida a esta: [['PRUEBA-C', true], ['PRUEBA-B', true], ...]
        //Luego con esta matriz crea un hashmap, para una busqueda de tiempo constante de strings
        //Hemos mapeado el id de cada template con su objeto original
        this.idList = new Map(templates.map(obj => [obj.id.toUpperCase(), obj]));
    },

    runTemplateScripts: function(temp) {
        for(let script of Array.from(temp.content.querySelectorAll("script"))) {
            eval(script.innerHTML);
            //
            script.remove(); //Esto elimina el script logico copiado del template, no el script del template en si
        }
    },

    markSlots: function(elem) {
        this.deepSearch(elem, (currentNode, tree) => {
            if(currentNode.children.length > 0) {
                for(let child of Array.from(currentNode.children)) {
                    child.setAttribute(this.slotAttributeName, "");
                }
            }
        });
    },

    deepSearch: function(root, fn, shadowBypass = false) {
        let tree = document.createTreeWalker(root);

        for(let currentNode = tree.currentNode; currentNode; currentNode = tree.nextNode()) {  //El arbol se actualiza cuando agregamos los templates a las instancias, por lo que llama de nuevo para las instancias internas
            let nodeTag = currentNode.tagName;

            if(currentNode.nodeType === Node.ELEMENT_NODE) {
                if(this.idList.has(nodeTag)) {
                    fn(currentNode, tree);

                    if(!!currentNode.shadowRoot) {
                        this.deepSearch(currentNode.shadowRoot, fn, shadowBypass);
                    }
                } else if(nodeTag === 'TEMPLATE') {
                    if(shadowBypass && currentNode.className === this.templateWraperName) {
                        continue;
                    } else if(currentNode.className === this.templateClassName) {  //Hace bypass de los templates de genc, solo se lo utiliza al resolver componentes del body
                        continue;
                    } else {
                        this.deepSearch(currentNode.content, fn, shadowBypass);
                    }
                }
            }
        }
    },

    //Para que un parametro idList? porque necesitamos una variable estatica entre las llamadas recursivas
    //templates y idLIst tienen referencias al mismo objeto, asi que cualquier modificacion en ambos, esta modificando a los templates originales
    
    //Nos tenemos que saltar al contenido recien clonado, sino se copia dos veces
    resolveTemplateDependency: function(templates) {  //Se necesita el parametro 'templates' ya que en las llamadas recursivas se necesita pasar el template actual y la lista completa de tempalates idList
        templates = this.validate(templates);
        
        for(let temp of templates.values()) {
            if(!temp.analized) {
                this.deepSearch(temp.content, (currentNode, tree) => {
                    let nodeTag = currentNode.tagName;
                
                    if(this.idList.get(nodeTag).analized === true) { //Si el objeto original del template tiene un atributo analized, no lo volvemos a analizar y pasamos al siguiente nodo del template actual
                        let tempClone = this.idList.get(nodeTag).cloneNode(true);
                        this.shadowWraper(currentNode, tempClone.content); //Aqui hacemos varias cosas, primero: idList.get(currentNode.tagName), obtenemos el objeto de template original, luego .content, obtenemos el contenido del documentFragment, y luego importNode, importa el contenido del template en un nuevo nodo y se lo pasamos al placeContent

                    } else {
                        this.resolveTemplateDependency(new Map([["not_used", this.idList.get(nodeTag)]])); //idList.get(currentNode.id) regresa el objeto del template original, esta funcion solo regresa cuando ha terminado de analizar todo el template completo

                        let tempClone = this.idList.get(nodeTag).cloneNode(true);
                        this.shadowWraper(currentNode, tempClone.content);        //Luego del primer analisis, tembien debemos hacer un placeContent en el elemento

                    }
                }, true);

                temp.analized = true;
            }
        }
    },
    validate: function(data) {
        if(data instanceof Map) {
            return data;
        } else if (data instanceof HTMLTemplateElement) {
            return new Map([[data.id.toUpperCase(), data]]);
        }
    },
    shadowWraper: function(node, temp) {
        let wrap = document.createElement("template");
        wrap.className = this.templateWraperName;
        
        node.appendChild(wrap);
        node.querySelector(`template.${this.templateWraperName}`).content.appendChild(temp);
    },

    //El moveSlots deberia ser de abajo hacia arriba porque luego se pierden las referencias a currentNode
    moveSlots: function(elem) {
        this.deepSearchSlots(elem, (currentNode, tree) => {
            let webcomponentBody = currentNode.parentNode.querySelector(`:scope > template.${this.templateWraperName}`).content;
            let getsElement;

            if(currentNode.hasAttribute("puts")) {
                let puts = currentNode.getAttribute("puts");
                getsElement = this.selectGetsElement(webcomponentBody, puts, currentNode);
            } else {
                getsElement = this.selectGetsElement(webcomponentBody, "default", currentNode);
            }

            if(!!getsElement) {  //Si el getsElement no es null, hacemos lo siguiente
                tree.previousNode();  //Intente con nextNode() pero no funciono, debe ser porque al hacer esto, el currentMode se toma mirando al nodo anterior, y lo eliminamos, entonces si tomamos el anterior, la lista se reordena
                getsElement.appendChild(currentNode.cloneNode(true));
                currentNode.remove();
            } else {  //Si no existe un gets en el elemento, simplemente eliminamos los elementos parametro
                tree.previousNode();
                currentNode.remove();
            }
        });
    },
    deepSearchSlots: function(root, fn) {
        let tree = document.createTreeWalker(root);

        for(let currentNode = tree.firstChild; currentNode; currentNode = tree.nextNode()) {  //El arbol se actualiza cuando agregamos los templates a las instancias, por lo que llama de nuevo para las instancias internas
            let nodeTag = currentNode.tagName;

            if(currentNode.nodeType === Node.ELEMENT_NODE) {
                if(currentNode.hasAttribute(this.slotAttributeName)) {
                    this.deepSearchSlots(currentNode, fn);  //Esto causa un analisis retrasado/postergado, primero analiza los slots mas anidados

                    fn(currentNode, tree);
                } else if(nodeTag === 'TEMPLATE') {  //No se puede saltar los shadow, ya que debemos revisar el interior de los shadow tanto en tmeplates como en las paginas
                    if(currentNode.className === this.templateClassName) {  //Hace bypass de los templates de genc, solo se lo utiliza al resolver componentes del body
                        continue;
                    } else {
                        this.deepSearchSlots(currentNode.content, fn);
                    }
                }
            }
        }
    },
    selectGetsElement: function(body, getsValue, slotElement) {  //Esto funciona incluso adentro de los slots de un webcomponent, ya que no estan adentro del shadow
        let getsElement;
        this.deepSearchGets(body, (currentNode) => {
            if(currentNode.getAttribute("gets") === getsValue) {
                if(currentNode.tagName === 'TEMPLATE') {
                    getsElement = currentNode.content;
                    slotElement.removeAttribute(this.slotAttributeName);
                } else if(this.idList.has(currentNode.tagName)) {  //Si el gets es un webcomponent, no podemos eliminar el atributo slot, ya que aun debe ser anidado adentro del webcomponent
                    getsElement = currentNode;
                } else {
                    getsElement = currentNode;
                    slotElement.removeAttribute(this.slotAttributeName);
                }
            }
        });

        return getsElement;
    },
    deepSearchGets: function(root, fn) {
        let tree = document.createTreeWalker(root);

        for(let currentNode = tree.currentNode; currentNode; currentNode = tree.nextNode()) {  //El arbol se actualiza cuando agregamos los templates a las instancias, por lo que llama de nuevo para las instancias internas
            let nodeTag = currentNode.tagName;

            if(currentNode.nodeType === Node.ELEMENT_NODE) {
                if(currentNode.hasAttribute("gets")) {
                    fn(currentNode, tree);
                } else if(nodeTag === 'TEMPLATE') {
                    if(currentNode.className === this.templateWraperName) {
                        continue;
                    } else if(currentNode.className === this.templateClassName) {  //Hace bypass de los templates de genc, solo se lo utiliza al resolver componentes del body
                        continue;
                    } else {
                        this.deepSearchGets(currentNode.content, fn);
                    }
                }
            }
        }
    },


    replaceShadowTemplates: function(elem) {
        this.deepSearch(elem, (currentNode, tree) => {
            let shadowTemplate = currentNode.querySelector(`:scope > template.${this.templateWraperName}`);
            if(!!shadowTemplate) {
                let shadowTemplateClone = shadowTemplate.cloneNode(true);
                shadowTemplate.remove();

                currentNode.attachShadow({ mode: 'open' });
                currentNode.shadowRoot.appendChild(shadowTemplateClone.content);
            }
        }, false);
    },

    replaceInstances: function(elem) {
        this.deepSearch(elem, (currentNode, tree) => {
            let tempClone = this.idList.get(currentNode.tagName).cloneNode(true);
            this.shadowWraper(currentNode, tempClone.content);
        }, true);
    },


    bodyInstances: [],
    //Esta funcion tambien es llamada por los constructores con los componentes recien creados
    initInstances: function(elem) {
        this.pageWalk(elem, (currentNode) => {
            this.bodyInstances.push(currentNode);  //Las instancias adentro de templates no son instanciadas "new Object()" por el motor DOM, por lo que no se ejecutan y nos sale una advertencia "prueba-a has no main"
        });

        for(let comp of this.bodyInstances) {
            //fase 4: Ejecutar el main de las instancias
            if(comp.main) {
                asyn(() => {comp.main();});
            }
        }
    },
    pageWalk: function(root, fn) {
        let tree = document.createTreeWalker(root);

        for(let currentNode = tree.currentNode; currentNode; currentNode = tree.nextNode()) {  //El arbol se actualiza cuando agregamos los templates a las instancias, por lo que llama de nuevo para las instancias internas
            let nodeTag = currentNode.tagName;

            if(currentNode.nodeType === Node.ELEMENT_NODE) {
                if(!!window.customElements.get(currentNode.tagName.toLowerCase())) {  //Debemos ejecutar cualquier customElement, con o sin vista
                    fn(currentNode);

                    if(!!currentNode.shadowRoot) {
                        this.pageWalk(currentNode.shadowRoot, fn);
                    }
                }
            }
        }
    },
};

//No ejecuta el main de los nuevos componentes, ejecutar con gencEngine.initInstances(elem)
let gencapi = {
    newTemplate: function(str) {
        let temp = this.stringToElement(str);
        temp.className = gencEngine.templateClassName;

        gencEngine.runTemplateScripts(temp);
        gencEngine.markSlots(temp.content);
        gencEngine.resolveTemplateDependency(temp);
        gencEngine.moveSlots(temp.content);

        gencEngine.idList.set(temp.id.toUpperCase(), temp);

        return temp;
    },

    newComponent: function(str) {
        let isHTML = /(<([^>]+)>)/i;

        let component;
        if(isHTML.test(str)) {
            component = this.stringToElement(str);

            gencEngine.markSlots(component);
            gencEngine.replaceInstances(component);
            gencEngine.moveSlots(component);
            gencEngine.replaceShadowTemplates(component);
        } else {
            component = document.createElement(str);

            gencEngine.replaceInstances(component);
            gencEngine.replaceShadowTemplates(component);
        }

        return component;
    },

    stringToElement: function(str) {
        let wraper = document.createElement("div");
        wraper.insertAdjacentHTML('beforeend', str);

        let element = wraper.firstElementChild;
        wraper.remove();

        return element;
    },
};


//Async API
//###################################################################################################################################################################
function asyn(f) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            f();
            resolve();
        }, 0);
    });
}


//Signals API
//###################################################################################################################################################################
function addSignal(obj) {
    if(!obj.signals) {
        obj.signals = {};
    }

    for(let i = 0; i < arguments.length; i++) {
        obj.signals[arguments[i]] = [];
    };
}

function listenSignal(obj, signal, f) {
    if(!obj.signals) {
        console.log(obj.tagName + ' has no signals object');
    } else {
        obj.signals[signal].push(f);
    }
}

function fireSignal(obj, signal) {
    for(let func of obj.signals[signal]) {
        asyn(() => {func();});
    }
}

//Comunication API
//###################################################################################################################################################################
/*
Debe ofrecer una funcion con la funcionalidad basica y una sintaxis basica lista para usar sin que el programador tenga que reescribir el comportamiento default una
y otra vez.

La funcion va a ofrecer la siguiente sintaxis: Recibe una cadena json y lo transforma en un objeto real
- get: simplemente recupera el dato y lo coloca en el array de devolucion.
- set: establece el valor de la propiedad indicada.
- call: llama a una funcion y le pasa los argumentos.

Si el programador quiere agregar sinonimos, simplemente se los pasa a la llamada del comunication, si quiere agregar un comportemiento personalizado, tambien se lo
pasa al comunication:

IMPERATIVO
com: function(json) {
    communication.settings({
        synonims: [
            ["foo", "foobar"],
            ["sumWithFloats", "sum"]
        ]
    });

    communication.default(json);
}

Async API:
DECLARATIVO
La API lee las propiedades y las convierte en asincronicas, pero esto despues, por ahora seria un exceso de funcionalidad.
async_main() {...}

async_foo() {...}
*/

/*
Integrar trio (structured concurrency) en gencjs
*/
