function(instance, properties, context) {

  // debugger
      
  let crawl = (object, path='', values = {}) => {
    if ( _.isArray(object) ) {
      values[path] = []
      let subValues = {}
      for ( let subObject of object ) {
        crawl(subObject, path, subValues)
        values[path].push(subValues)
      }

    } else if ( _.isObject(object) ) {
        _.forEach(object, (value, key) =>
          crawl(value, (path ? path + '.' : '_api_c2_') + key, values)
        )
    } else values[path] = object
    return values
  }
    
  instance.publishState('value', crawl(JSON.parse(properties.json)) )
    
}