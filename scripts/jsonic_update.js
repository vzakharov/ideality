function(instance, properties, context) {


  let crawl = (object, parent, fullPath = '', types = [], path='', result = {}) => {

    let pushContext = (...values) => {
      let type = _.find(types, { fullPath })
      if ( !type ) {
        types.push({fullPath, values: []})
        type = _.last(types)
      }
      type.values.push(...values)
      type.isList = type.isList || values.length > 1
    }
    
    if ( _.isArray(object) ) {
      let array = object
      result[path] = []
      for ( let item of array ) {
        result[path].push(crawl(item, array, fullPath, types).result)
      }
      // debugger
      pushContext(...result[path])
    } else if ( _.isObject(object) ) {
      _.forEach(object, (item, key) => {
        crawl(item, object, fullPath + '.' + key, types, (path ? path + '.' : '_api_c2_') + key, result)
      })
    } else {
      let value = object
      if ( _.isArray(parent) )
        result = value
      else {
        result[path] = object
        pushContext(object)  
      }
    }

    return { result, types }
  }
    
  let { result, types } = crawl(JSON.parse(properties.json))

  let arrayTypes = 
    _.filter(types, {isList: true})
    .map(type => type.fullPath.match(/^(.*)\.(.*)$/).slice(1))
    .filter(e => e[0])
    .map(e => [e[0], `_api_c2_${e[1]}`])
  
  arrayTypes.forEach(key => {
    let type = _.find(types, {fullPath: key[0]})
    type.values.filter( value => !value[key[1]] )
      .forEach(value => value[key[1]] = [])
  })
  
  // debugger 

  instance.publishState('value',  result)
    
}