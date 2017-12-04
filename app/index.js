class ImageViewerComponent extends HTMLElement {

    connectedCallback () {

        console.log("asd");

        //Reads field src to get the PATH URL to the source
        const source = this.getAttribute('src');

        console.log(source);

        if (!source) {
            return console.warn('"src" attribute not defined for element');
        }

        const extension = source.match(/[^\.]+$/)[0];

        let handler:
        switch (extension) {

            case 'svg': {
                handler = new SVGHandler();
            } break;

        }
        
    }

}

customElements.define('image-viewer', ImageViewerComponent);