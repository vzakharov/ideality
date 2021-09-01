ideality = {}

ideality.readDocument = document => {


    Object.assign(ideality, { document })


    document.variations = _.sortBy(document.variations, 'body')

    let { variations } = document

    // Build the tree

    ideality.tree = []
    let lastVariation = {}

    let { tree } = ideality

    for ( let variation of variations ) {

        let { body } = variation
        let lastBody = lastVariation.body

        for ( let i = 0; i < body.length; i++) {

            if ( i < lastBody.length && body[i] == lastBody[i] ) continue

            tree.push({
                body: body.slice(0, i)
            })

        }

    }

}
