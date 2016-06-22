(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(<%= amd %>, function (<%= param %>) {
      return (<%= namespace %> = factory(<%= param %>));
    });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(<%= cjs %>);
  } else {
    root.<%= namespace %> = factory(<%= global %>);
  }
}(this, function (<%= param %>) {
  <%= contents %>
  return <%= exports %>;
}));
