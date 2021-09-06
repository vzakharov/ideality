i = ideality = {}

i.nodeById = id => _.find(i.nodes, {id})

i.currentNode = () => i.nodeById(i.nodeId)

i.parent = node => i.nodeById(node.parentId)

i.setParent = (node, parent) => Object.assign(node, { parentId: parent.id })

i.children = node => _.filter(i.nodes, {parentId: node.id})

i.branched = node => i.children(node).length > 1

i.siblings = node => _.without(
  i.parent(node) ? i.children(i.parent(node)) : i.rootNodes(),
  node
)

i.hasSiblings = node => i.siblings(node).length > 0

i.leafs = () => i.nodes.filter(node => i.children(node).length == 0)

i.ancestors = node => {
  let parent = i.parent(node)
  return parent ? [...i.ancestors(parent), parent] : []
}

i.threads = () => i.leafs().map( node => [...i.ancestors(node), node] )

i.lastNumericId = () => 
  i.nodes.map(
    node => parseInt(node.id)
  ).filter(node=>node).sort().pop()

i.newNode = () => {
  let newNode = {
    id: (i.lastNumericId() + 1).toString()
  }
  i.nodes.push(newNode)
  return newNode
}

i.newChild = parent => i.setParent(i.newNode(), parent)

i.insertNode = parent =>
  i.children(parent).forEach( 
    child => i.setParent(child, i.newChild(parent))
  )

i.listOfJsons = elements => elements.map(element => JSON.stringify(element))

i.combinedBody = (nodes, {withLinks}) => 
  nodes.map(node => 
    withLinks ? 
      `[url=?node=${node.id}]${node.body}[/url]`
      : node.body
  ).join('')

i.homifyUrls = () =>
  [...document.getElementsByTagName('a')]
  .forEach(anchor => {
    let url = new URL(anchor.href)
    if ( url.host != location.host ) return false
    let [parameter, value] = [...url.searchParams][0]
    log(anchor).onclick = () => {
      window[`bubble_fn_goto_${parameter}`](value)
      return false
    }
  })

i.observer = new MutationObserver(i.homifyUrls)

i.observe = id =>
  i.observer.observe(document.getElementById(id), {subtree: true, characterData: true, childList:true})

i.depth = node => i.ancestors(node).filter(ancestor => i.branched(ancestor)).length

i.rootNodes = () => i.nodes.filter(node => !node.parentId)

i.tree = (parents = i.rootNodes()) =>
  parents.map(
    node => [
      node,
      ... i.tree(i.children(node))
    ] 
  ).flat()

i.current = {
  thread: null,
  node: null
}

i.goto = node => {
  i.current.node = node
  if ( !i.current.thread || !i.current.thread.includes(node) )
    i.current.thread = _.findLast( i.threads(), thread => thread.includes(node) )
}


i.treeView = node =>
    ' '.repeat(i.depth(node) + (i.hasSiblings(node) ? 0 : 1))
    + ( i.hasSiblings(node) ? '└' : '' )
    + node.body

log = what => {
  console.log(what)
  return what
}

isObject = variable => typeof variable === 'object' && variable !== null && !Array.isArray(variable)

logify = (object, path = '', logified = []) => {
  for (let key in object) {
    logified.push(object)
    let subpath = [path, key].join('.')
    console.log(subpath)
    if ( typeof object[key] == 'function' ) {
      let func = object[key]
      object[key] = (...args) => {
        console.log({subpath, func, args})
        return func(...args)
      }
    } else if ( isObject(object[key]) && !logified.includes(object[key]))
        setTimeout(logify, 1, ...[object[key], subpath, logified])
  }
}
