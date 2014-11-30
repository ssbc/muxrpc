

exports.set = function (obj, path, value) {
  var _obj, _k
  for(var i = 0; i < path.length; i++) {
    var k = path[i]
    obj[k] = obj[k] || {}
    _obj = obj; _k = k
    obj = obj[k]
  }
  _obj[_k] = value
}

exports.get = function (obj, path) {
  var value
  for(var i = 0; i < path.length; i++) {
    var k = path[i]
    value = obj = obj[k]
    if(null == obj) return obj
  }
  return value
}

exports.prefix = function (obj, path) {
  var value, parent = obj

  for(var i = 0; i < path.length; i++) {
    var k = path[i]
    value = obj = obj[k]
    if('object' !== typeof obj) {
      return obj
    }
    parent = obj
  }
  return 'object' !== typeof value ? !!value : false
}
