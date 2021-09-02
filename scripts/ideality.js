ideality = {}



ideality.nodeById = id => _.find(ideality.nodes, {id})

ideality.parent = node => ideality.nodeById(node.parentId)

ideality.children = node => _.filter(ideality.nodes, {parentId: node.id})

ideality.leafs = () => ideality.nodes.filter(node => ideality.children(node).length == 0)

ideality.roots = node => {
  let parent = ideality.parent(node)
  return parent ? [...ideality.roots(parent), parent] : []
}

ideality.threads = () => ideality.leafs().map( node => [...ideality.roots(node), node] )

