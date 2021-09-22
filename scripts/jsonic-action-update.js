function(properties, context) {

  // debugger 

  let { jsonicKey, objectKey, changes } = properties


  //Load any data 

//Do the operation

  let jsonic = _.get(window, jsonicKey)

  if ( objectKey ) {
    let object = _.get(jsonic, objectKey)

    for (let change of changes ) {
      let { key, value } = change
      try {
        value = JSON.parse(value)
      } catch {}
      _.set(object, key, value)
    }
  }

  jsonic._update_()

}