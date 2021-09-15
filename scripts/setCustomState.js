p.SetCustomState = {
  field_names: U.extend({
    value: {
      optional: !0
    },
    custom_state: {},
    custom_states_values: {
      optional: !0
    }
  }, M),
  run: function(action, customState, element, callback) {
    return U.run_once(30, (function() {
      var e, r, i, o, a, s, l;
      if (s = {
        instance: e = element.element.find_instance_by_id(customState.element_id),
        custom_states: [],
        values: []
      },
      null == e)
        return s;
      if (s.custom_states.push(customState.custom_state),
      e.element.element_custom_state(customState.custom_state).make_static() && (null != (i = customState.value) && "function" == typeof i.make_static ? i.make_static() : void 0) ? s.values.push(customState.value.make_static()) : s.values.push(customState.value),
      null != customState.custom_states_values)
        for (r in o = customState.custom_states_values)
          l = o[r],
          s.custom_states.push(l.custom_state),
          e.element.element_custom_state(l.custom_state).make_static() && (null != (a = l.value) && "function" == typeof a.make_static ? a.make_static() : void 0) ? s.values.push(l.value.make_static()) : s.values.push(l.value);
      return s
    }
    ), (function(e, t) {
      var n, i, o, a, s, l, u;
      if (e)
        callback(e);
      else {
        if (o = t.instance,
        n = t.custom_states,
        u = t.values,
        o) {
          for (i = a = 0,
          s = u.length; a < s; i = ++a)
            l = u[i],
            o.state(n[i], null != l ? l : null);
          return callback()
        }
        callback()
      }
    }
    ))
  }
}

t.prototype.run_subsequent_actions = function(logger, workflowActions) {
  var action, r, i;
  return null == (action = workflowActions.next()) ? (logger.log("workflow is finished"),
  v.Promise(!0)) : (r = action.evaluate_properties_client_side(logger),
  this.debug(action, r, logger).then((i = this,
  function() {
    var actionPromise, o, a;
    return actionPromise = v.Promise(null, null != (o = "Running action " + (null != action ? action.id() : void 0)) ? o : "<done>"),
    logger.log("about to run " + action.type() + " " + action.id()),
    "TriggerCustomEvent" === (a = action.type()) || "TriggerCustomEventFromReusable" === a ? actionPromise.resolve(i.start_custom_workflow(logger, action)) : action.run(logger, r, (function(outcome, result) {
      return outcome ? "aborted" === outcome ? actionPromise.resolve() : actionPromise.reject(outcome) : (logger.log("successfully ran " + action.type() + " " + action.id() + " with result " + result),
      logger.update_from_action(action, r, result).callback((function(r) {
        var o;
        if (!r) {
          if (action.requires_server() && "pending" === logger.server_completion_promise.inspect().state) {
            if (!logger.server_call_id)
              throw new Error("could not find our server call");
            o = logger.server_call_context + action.id(),
            i.open_server_actions.push({
              server_call_id: logger.server_call_id,
              action_id: o
            })
          }
          return "DisplayGroupData" === action.type() ? setTimeout((function() {
            return actionPromise.resolve(i.run_subsequent_actions(logger, action))
          }
          ), 0) : actionPromise.resolve(i.run_subsequent_actions(logger, action))
        }
        actionPromise.reject(r)
      }
      )))
    }
    )),
    actionPromise
  }
  )))
}