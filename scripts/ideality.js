if (!window.i)
  i = ideality = {
    nodes: []
  }

if (!i.current)
  i.current = {}

Object.defineProperties(i.current, {
  node: {
    get: () => i.current.thread[Stator.nodeIndex]
  },
  thread: {
    get: () => i.threads()[Stator.threadIndex]
  }
})


i.save = () => {
  i.savedJson =_.last(i.history)
  bubble_fn_save(jsyaml.dump(_.pick(ideality, ['nodes'])))
}

i.nodeById = id => _.find(i.nodes, {id})

i.currentNode = () => i.nodeById(i.nodeId)

i.parent = node => node ? i.nodeById(node.parentId) : undefined

i.setParent = (node, parent) => Object.assign(node, { parentId: parent ? parent.id : null })

i.children = parent => parent ? _.filter(i.nodes, {parentId: parent.id}) : i.rootNodes()

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

i.lineage = node => [...i.ancestors(node), node]

i.descendants = (parent, thread) =>
  thread ?
    thread.filter(node => i.ancestors(node).includes(parent))
    : i.children(parent).map(child =>
      [child, ...i.descendants(child)]
    ).flat()

i.branchedNodes = (nodes) =>
  (nodes || i.nodes).filter(node => i.branched(node))

i.branchedDescendants = (parent, thread) =>
  i.branchedNodes(i.descendants(parent, thread))

i.variation = thread =>
  _.last(
    thread.filter(node => i.hasSiblings(node))
  ) || thread[0]

i.variations = () => {
  let variations = i.branchedNodes().map(
    parent => i.children(parent)
  ).flat()
  return variations.length > 0 ? variations : [i.nodes[0]]
}

T = i.Threads = {}

T.withNode = (node, threads = T.all()) => node ? threads.filter(thread => thread.includes(node)) : threads

T.all = i.threads = () => i.leafs().map( node => [...i.ancestors(node), node] )

i.threadsFor = node => i.threads().filter(thread => thread.includes(node))

i.defaultThreadFor = node => _.last(i.threadsFor(node))

i.refresh = () => {
  i.history.push(JSON.stringify(nodes))
  bubble_fn_refresh()
}

N = i.NodeAction = {}

N.create = () => {
  let newNode = {
    id: (_.max(
      _.map(
        i.nodes, node => parseInt(node.id)
      )
    ) + 1 || 1).toString()
  }
  i.nodes.push(newNode)
  return newNode
}

N.branchOut = parent => i.setParent(N.create(), parent)

N.createSibling = node => N.branchOut(i.parent(node))

N.insert = parent => {
  let children = i.children(parent)
  let newChild = N.branchOut(parent)
  children.forEach( 
    child => i.setParent(child, newChild)
  )
  return newChild
}


N.clone = (node, deep = false, newParent = i.parent(node)) => {
  let newNode = Object.assign(i.setParent(N.createSibling(node), newParent), {body: node.body})
  if ( deep ) {
    i.children(node).forEach(child =>
      N.clone(child, true, newNode)
    )
  }
  return newNode
}

N.cloneBranch = node => N.clone(node, true)

N.delete = (node, {deep, remember, topmost}) => {
  if ( remember ) {
    if ( topmost ) {
      i.copiedNodes = []
    }
    i.copiedNodes.push(node)
  }
  let parent = i.parent(node)
  i.children(node).forEach(child => 
    deep
      ? N.delete(child, {deep, remember, topmost: false})
      : i.setParent(child, parent)
  )
  _.pull(i.nodes, node)
  return parent
}

N.deleteBranch = (node, remember) => N.delete(node, {deep: true, remember, topmost: true})

N.copy = node => {
  N.cut(N.cloneBranch(node))
  return node
}

N.cut = node => N.deleteBranch(node, true)

N.paste = ( nodeToPasteAfter ) => {
  let topCopiedNode = i.copiedNodes[0]
  i.nodes.push(...i.copiedNodes)
  i.setParent(topCopiedNode, nodeToPasteAfter)
  i.copiedNodes = []
  return topCopiedNode
}

N.split = ( node, at = i.bodyInput().selectionStart ) => {
  let newNode = N.insert(node)
  let { body } = node
  node.body = body.slice(0, log(at))
  newNode.body = body.slice(at)
  return newNode
}

N.mergeWithParent = node => {
  let parent = i.parent(node)
  node.body = parent.body + node.body
  i.setParent(node, i.parent(parent))
  if ( i.children(parent).length == 0 ) {
    N.delete(parent)
  }
  return node
}

N.complete = async node =>
  _.assign(node, {body: (node.body || '') + await ai.complete(i.lineage(node), i.api)})

i.listOfJsons = elements => elements.map(element => JSON.stringify(element))

i.combinedBody = (nodes, {withLinks}) => 
  nodes.map(node => 
    withLinks ? 
      `[url=?node=${node.id}]${node.body}[/url]`
      : node.body
  ).join('')

i.escape = string => _.escape(string).replaceAll(/\n/g, '<br/>')

i.escapeWithQuotes = string => _.escape(`"${string}"`)

i.toggleExpand = id => {
  let node = i.nodeById(id)
  node.expanded = !node.expanded
  bubble_fn_refresh()
}

i.threadIndex = thread => i.threads().findIndex(t => _.last(t) == _.last(thread))

i.routingIndices = node => {
  let { thread } = i.current
  if ( !thread || !thread.includes(node) ) {
    thread = _.findLast(i.threads(), thread => thread.includes(node))
  }
  return {
    v: i.threadIndex(thread),
    n: _.findIndex(thread, node)
  }
}

i.routingString = node => 
  _.map(
    i.routingIndices(node), 
    (value, key) => [key, value].join('=')
  ).join('&')


i.nodeDisplay = node => `<a href="?${i.routingString(node)}" onclick="i.gotoId(${i.escapeWithQuotes(node.id)}); return false">${i.escape(node.body) || "<em>[tba]</em>"}</a>`

i.display = nodes => 
  `<div style="font-family: Barlow, sans-serif; line-height: 1.5;">${nodes.map(node => {
    let body = ( node == i.current.node ? '' : i.nodeDisplay(node) )
    if ( i.branched(node) ) {
      body += `<span style="color: lightgray; font-size:x-small; vertical-align: bottom;"><a href="#" onclick="i.toggleExpand(${i.escapeWithQuotes(node.id)}); return false">${node.expanded ? '⊟' : '⊞'}</a></span>`
      if ( node.expanded ) {
        body += `<div style="color:lightgray; font-size:small;"><ul>${i.children(node).filter(child => !i.current.thread.includes(child)).map( child => 
          `<li>${i.nodeDisplay(child)}</li>`
        ).join('')}</ul></div>`
      }
    }
    return body
  }).join('')}</div>`

i.bodyInput = () => document.getElementById('body-input')

i.depth = node => i.ancestors(node).filter(ancestor => i.branched(ancestor)).length

i.rootNodes = () => i.nodes.filter(node => !node.parentId)

i.sortAsTree = (parents = i.rootNodes()) =>
  parents.map(
    node => [
      node,
      ... i.sortAsTree(i.children(node))
    ] 
  ).flat()

i.gotoId = id => i.goto(i.nodeById(id))

i.goto = node => {
  if (node != i.current.node)
    bubble_fn_goto(_.values(i.routingIndices(node)))
  else
    i.refresh()
}

i.treeView = node =>
    ' '.repeat(i.depth(node) + (i.hasSiblings(node) ? 0 : 1))
    + ( i.hasSiblings(node) ? '└' : '' )
    + ( node.body || "[i][tba][/i]")


// AI

ai = ideality.AI = {}

ai.complete = async (nodes, api) => {

  let prompt = nodes.map(node => {
    return node.body
  }).join('')

  let { url, auth, bodyPattern, parameters, location } = {parameters: {}, ...api}


  _.assign(parameters, { prompt })

  for ( let slug in log(parameters) ) {
    bodyPattern = bodyPattern.replace('@'+ slug, stringify(parameters[slug]))
  }

  let body = JSON.parse(bodyPattern)

  console.log ({auth, body})
  return _.get(await post(url, {auth, body}), location)

}


// Bubble-specific

B = ideality.Bubble = {}

B.loadYaml = () => {
  _.assign(i, jsyaml.load(Stator.yaml))
  i.history = [i.savedJson = JSON.stringify(i.nodes)]
  i.refresh()
}

B.doAction = slug => {
  Promise.resolve(
    N[slug](i.current.node)
  ).then(newNode =>
    i.goto(newNode)
  )
}

B.enclosingNodes = () => {
  let { nodeIndex } = Stator
  let { thread } = i.current
  if ( nodeIndex )
    return [
      thread.slice(0, nodeIndex),
      thread.slice(nodeIndex+1)
    ]
  else
    return [thread, []]
}

B.displayBeforeAfter = () => _.map(B.enclosingNodes(), i.display)

// Generic

stringify = value => JSON.stringify(value).replaceAll(/^"|"$/g, '')

purge = object => _.pickBy(object, _.identity)

i.fetch = async (url, {method, auth, headers, params, body}) => {
  console.log({method, auth, headers, params, body})
  method = method || 'POST'
  headers = {}
  if (auth) {
    headers['Authorization'] = auth
  }
  if (body) {
    body = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  if (params) 
    url += (
      url.includes('?') ? '&' : '?'
    ) + new URLSearchParams(params).toString()
  let fetchArgs = purge({method, headers, body})

  console.log(fetchArgs)

  return await (await fetch(url, fetchArgs)).json()
}

post = (url, args) => i.fetch(url, {method: 'POST', ...args})

log = what => {
  if (Stator.appVersion == 'test') console.log(what)
  return what
}


fl = i.functionLog = {
  depth: 0,
  functions: [],
  calls: [],
  visual: ''
}

fl.clear = function() {this.calls = []; this.visual = ''}

fl.add = (...objects) => 
  objects.forEach(obj => 
    Object.getOwnPropertyNames(obj)
    .filter(key => typeof obj[key] == 'function')
    .forEach(name => {
      let code = obj[name]
      fl.functions.push({obj, name, code})
      obj[name] = (...args) => {
      fl.depth++
      let { depth } = i.functionLog
      let logged = { depth, name, timestamp: new Date(), code, args, completed: false }
      fl.calls.push(logged)
      fl.visual += `\n${'·'.repeat(depth)}${name}`
      try {
          let result = code(...args)
          _.assign(logged, {result, completed: true})
          return result
        } catch (e) {
          _.assign(logged, {failed: true, e})
        } finally {
          fl.depth--
        }
      }
    })
  )

true