i.nodes = []

if (!i.current)
  i.current = {}

defineProperties = (object, properties) =>
Object.defineProperties(
  object, 
  _.mapValues(properties, property => 
    _.assign(property, {
      configurable: true
    })
  )
)


i.getParam = name => new URL(window.location.href).searchParams.get(name)

i.route = url => {
  // debugger
  let variationId = i.getParam('v')
  let variation = i.nodeById(variationId) 
  let thread = variation ? i.threads().find(thread => thread.includes(variation)) : i.threads()[0]
  let nodeId = i.getParam('n')
  let node = i.nodeById(nodeId)
  if ( !thread.includes(node) )
    node = null
  _.assign(i.current, { thread, node })
  bubble_fn_routed(true)
  return node && node.id
}

i.tree = (nodes = i.rootNodes()) =>
  nodes.map(node => ({
    ...node, children: i.tree(i.children(node))
  }))


i.xmlTree = (nodes = i.rootNodes(), { container } = {}) => {

  if ( !container ) {
    container = document.createElement('ul')
    container.id = 'document-tree'
  }

  nodes.forEach( node => {
    let element = document.createElement('li')
    element.setAttribute('id', node.id)
    element.innerText = node.body
    i.xmlTree(i.children(node), {container: element.appendChild(document.createElement('ul'))})
    container.appendChild(element)
  })

  return container

}

i.yaml = () => jsyaml.dump(_.pick(ideality, ['nodes']))

i.save = () => {
  i.savedJson =_.last(i.history)
  bubble_fn_save(i.yaml())
}

i.downloadYaml = () => {
  download(i.yaml(), S.documentSlug+'.yml')
}

i.downloadThread = () => {
  download(i.current.thread.map(node => node.body || '').join(''), S.documentSlug+'.txt')
}

i.nodeById = id => _.find(i.nodes, {id})

i.currentNode = () => i.nodeById(i.nodeId)

i.parent = node => node ? i.nodeById(node.parentId) : null

i.setParent = (node, parent) => Object.assign(node, { parentId: parent ? parent.id : null })

i.children = parent => parent ? _.filter(i.nodes, {parentId: parent.id}) : i.rootNodes()

i.branched = node => i.children(node).length > 1

i.siblings = node => _.without(
  i.parent(node) ? i.children(i.parent(node)) : i.rootNodes(),
  node
)

i.hasSiblings = node => i.siblings(node).length > 0

i.leafs = (nodes = i.nodes) => nodes.filter(node => i.children(node).length == 0)

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

i.heritage = node => node ? [node, ...i.heritage(_.first(i.children(node)))] : []

i.branchedNodes = (nodes) =>
  (nodes || i.nodes).filter(node => i.branched(node))

i.branchedDescendants = (parent, thread) =>
  i.branchedNodes(i.descendants(parent, thread))

i.variation = thread =>
  thread.filter(node => i.hasSiblings(node))[0]
  || thread[0]

i.variations = () => {
  let variations = i.branchedNodes().map(
    parent => i.children(parent)
  ).flat()
  return variations.length > 0 ? variations : [i.nodes[0]]
}

T = i.Threads = {}

T.withNode = (node, threads = T.all()) => node ? threads.filter(thread => thread.includes(node)) : threads

i.threads = (nodes = i.nodes) => i.leafs(nodes).map( node => [...i.ancestors(node), node] )

T.all = i.threads()

i.threadsFor = node => i.threads().filter(thread => thread.includes(node))

i.defaultThreadFor = node => (i.threadsFor(node))[0]

i.refresh = ({ dontFocusOnInput } = {}) => {
  // i.history.push(JSON.stringify(i.nodes))
  _.assign(S, {dontFocusOnInput} )
  bubble_fn_refresh(parseInt(new Date().toISOString().replace(/\D/g, '')))
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
  i.nodes.unshift(newNode)
  return newNode
}

N.branchOut = parent => i.setParent(N.create(), parent)

N.createSibling = node => N.branchOut(Object.assign(i.parent(node), {expanded: true}))

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

N.delete = (node, {deep, remember, topmost} = {}) => {
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

N.deleteChildren = node => {
  i.children(node).forEach(child => N.deleteBranch(child))
  return node
}

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

i.caretPosition = () => i.bodyInput().selectionStart

N.split = ( node, at = i.caretPosition() ) => {
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

N.mergeAndPurge = node => {
  i.siblings(node).forEach(sibling => N.deleteBranch(sibling))
  return N.mergeWithParent(node)
}

N.save = node => ( i.save(), node )

N.complete = async node => {
  let { api } = i

  let response = await ai.complete(node, i.api)

  let originalNode = node

  if ( node.body && ( node.body.length != i.caretPosition() || api.supportsMultiple )) {
    if ( node.body.length == i.caretPosition() )
      node = N.branchOut(node)
    else
      node = N.split(node)
    if ( node.body )
      node = N.createSibling(node)
  }
  if ( api.supportsMultiple ) {
    response.forEach(body => {
      if ( node.body )
        node = N.createSibling(node)
      _.assign(node, {body})
    })
    return originalNode
  } else {
    return _.assign(node, {body: (node.body || '') + response})
  }  
}

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
  i.refresh({ dontFocusOnInput: true })
}

i.threadIndex = thread => i.threads().findIndex(t => _.last(t) == _.last(thread))

i.routingIndices = node => {
  // debugger
  let { thread } = i.current
  if ( !thread || !thread.includes(node) ) {
    thread = _.find(i.threads(), thread => thread.includes(node)) || i.threads()[0]
  }
  return {
    v: _.last(thread).id,
    n: node && node.id
  }
}

i.routingString = node => 
  _.map(
    i.routingIndices(node), 
    (value, key) => [key, value].join('=')
  ).join('&')


i.nodeDisplay = (node, nested) => 
  (node == i.current.node ? '' : `<a 
    href="?${i.routingString(node)}" 
    onclick="
      i.gotoId(${i.escapeWithQuotes(node.id)}); 
      return false
    "
  >
    ${i.escape(node.body) || "<em>[tba]</em>"}
  </a>`
  ) + (i.branched(node) ?
    `<span 
      style="color: lightgray; font-size:x-small; vertical-align: bottom;"
    >
      <a 
        href="#" 
        onclick="
          i.toggleExpand(${i.escapeWithQuotes(node.id)}); 
          return false
        "
      >
        ${node.expanded ? '⊟' : '⊞'}
      </a>
    </span>` : ( nested ?
      i.children(node).map(child => i.nodeDisplay(child, true)) : ''
    )
  ) + (node.expanded && i.branched(node) ?
    `<div style="color:gray; font-size:small;">
      <ul>
        ${i.children(node).filter(child => !i.current.thread.includes(child)).map( child => 
          `<li>
            ${i.nodeDisplay(child, true)}
          </li>`
        ).join('')}
      </ul>
    </div>` : ''
  )

i.display = nodes => 
  `<div style="font-family: Barlow, sans-serif; line-height: 1.5; font-size: large;">${_.map(nodes, node => i.nodeDisplay(node, false)).join('')}</div>`

i.bodyInput = () => document.getElementById('body-input')

i.bodyInputFocused = () => document.activeElement == i.bodyInput()

i.depth = node => i.ancestors(node).filter(ancestor => i.branched(ancestor)).length

i.rootNodes = () => i.nodes.filter(node => !node.parentId)

i.sortAsTree = (parents = i.rootNodes()) =>
  parents.map(
    node => [
      node,
      ... i.sortAsTree(i.children(node))
    ] 
  ).flat()

i.changeId = ( node, newId ) => {
  _.filter(i.nodes, {
    parentId: node.id
  }).forEach(node => 
    node.parentId = newId
  )

  node.id = newId
}

i.gotoId = id => i.goto(i.nodeById(id))

i.goto = ( node, reroute) => {
  let newIndices = i.routingIndices(node)
  if (reroute || !equalJsons(newIndices, i.routingIndices(i.current.node))) {
    bubble_fn_goto(_.values(newIndices))
  } else
    i.refresh()
}

i.treeView = node =>
    ' '.repeat(i.depth(node) + (i.hasSiblings(node) ? 0 : 1))
    + ( i.hasSiblings(node) ? '└' : '' )
    + ( node.body || "[i][tba][/i]")


// AI

ai = ideality.AI = {}

ai.getPrompt = (node = i.current.node) => {
  let prompt = _.map (
    node ? i.lineage(node) : i.current.thread,
    'body'
  ).join('')
  let { cut } = _.get(i, 'api.config.settings')
  if ( cut ) {
    let { maxTokens, anchor, replaceWith } = cut
    let cutAt = prompt.indexOf(anchor)
    if ( cutAt < 0 ) cutAt = 0
    prompt = prompt.replace(anchor, '')
    let tokens = i.encode(prompt)
    let nToCut = tokens.length - maxTokens
    ai.promptWasCut = nToCut > 0
    if ( nToCut > 0 ) {
      let 
        fixedPrompt = prompt.slice(0, cutAt),
        fixedTokens = i.encode(fixedPrompt),
        replaceTokens = i.encode(replaceWith),
        tokensLeft = maxTokens - fixedTokens.length - replaceTokens.length,
        promptToCut = prompt.slice(cutAt),
        tokensToCut = i.encode(promptToCut),
        nTokensToDiscard = tokensToCut.length - tokensLeft
      prompt =
        fixedPrompt
        + replaceWith
        + i.decode(
          tokensToCut.slice(
            nTokensToDiscard
          )
        )
    }
  }
  return prompt
}

ai.getTokens = ( text = ai.prompt ) => i.encode(text)

defineProperties(ai, {

  prompt: { get: ai.getPrompt },

  tokens: { get: ai.getTokens }
  
})


ai.complete = async (node, api) => {

  // debugger
  
  let prompt = ai.getPrompt(node)

  let { config, auth, bodyPattern, location, arrayLocation } = {parameters: {}, ...api}

  let { settings, parameters } = config

  let settingsString = JSON.stringify(settings).replace('<Prompt>', stringify(stringify(prompt)))

  for ( let parameter of  parameters ) {
    settingsString = settingsString.replace(`<${parameter.name}>`, fallback(parameter.text, parameter.number, ''))
  }

  settings = JSON.parse(settingsString)

  let { url, fetchArgs } = settings

  console.log(url, fetchArgs)

  let response = await (await fetch(url, fetchArgs)).json()

  if ( api.supportsMultiple ) 
    return response[arrayLocation].map(choice => _.get(choice, location))
  else
    return response[location]

}


// Bubble-specific

B = ideality.Bubble = {}

B.loadYaml = (yaml = S.yaml) => {
  _.assign(i, jsyaml.load(yaml))
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
  let { node, thread } = i.current
  let nodeIndex = _.findIndex(thread, node)
  if ( node )
    return [
      thread.slice(0, nodeIndex),
      thread.slice(nodeIndex)
    ]
  else
    return [thread, []]
}

B.displayBeforeAfter = () => _.map(B.enclosingNodes(), i.display)

// Generic

fallback = (...chain) => 
  chain.length ?
    typeof chain[0] === 'undefined' ?
      fallback(...chain.slice(1))
      : chain[0]
    : undefined

equalJsons = (a, b) => JSON.stringify(a) == JSON.stringify(b)

download = (text, filename) => {
  let element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

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
  if (S.appVersion == 'test') console.log(what)
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

  
$(document).bind('keydown', e => {

  if ( e.ctrlKey ) {
    let slugByKeyCode = {
      83: 'save',
      13: 'split',
      32: 'complete'
    }
  
    let slug = slugByKeyCode[e.which]

    if ( slug ) {
      e.preventDefault()
      B.doAction(slug)
      return false  
    }
  }
})

export { ideality }