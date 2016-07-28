(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// The abstract syntax tree of Grace. Consists primarily of constructors.

"use strict";

var Task, util;

Task = require("./task");
util = require("./util");

// (this : Request | Signature).name() : String
//   Builds a name from the signature of a Request or Method.
function buildName() {
  var i, l, part, parts, signature, value;

  signature = this.parts;

  if (signature.length === 1) {
    part = signature[0];
    value = part.name;

    if (value.isOperator ||
        (part.parameters || part["arguments"]).length === 0) {
      return value.value;
    }
  }

  parts = [];

  for (i = 0, l = signature.length; i < l; i += 1) {
    parts.push(signature[i].name + "()");
  }

  return parts.join(" ");
}

// commas(left : String, list : [Object], right : String) : String
//   Build a comma separated list separated by the given arguments, or an empty
//   string if there is nothing in the list.
function commas(left, list, right) {
  return list.length === 0 ? "" : left + list.join(", ") + right;
}

// acceptAll(nodes : [Node], visitor : Visitor) : Task
//   Call the accept method on all of the nodes with the given visitor.
function acceptAll(nodes, visitor) {
  return Task.each(nodes, function (node) {
    return node.accept(visitor);
  });
}

// Top-level Node type, used as a type in Grace.
function Node(token) {
  this.location = token.location;
}

// Abstract expression constructor, used as a type in Grace.
function Expression(token) {
  Node.call(this, token);
}

util.inherits(Expression, Node);

// new Dialect(path : String)
//   A dialect directive.
function Dialect(path, token) {
  Node.call(this, token);

  this.path = path;
}

util.inherits(Dialect, Node);

Dialect.prototype.accept = function (visitor) {
  return visitor.visitDialect(this);
};

Dialect.prototype.toString = function () {
  return "dialect " + this.path;
};

// new Import(path : String, ident : Identifier)
//   An import directive.
function Import(path, ident, token) {
  Node.call(this, token);

  this.path = path;
  this.identifier = ident;
}

util.inherits(Import, Node);

Import.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitImport(this).then(function () {
    return self.identifier.accept(visitor);
  });
};

Import.prototype.toString = function () {
  return "import " + this.path + " as " + this.identifier;
};

// new Identifier(value : String, isOperator : Boolean = false)
//   An identifier.
function Identifier(value, isOperator, token) {
  Node.call(this, token);

  this.value = value;
  this.isOperator = isOperator === true;
}

util.inherits(Identifier, Node);

Identifier.prototype.accept = function (visitor) {
  return visitor.visitIdentifier(this);
};

Identifier.prototype.toString = function () {
  return this.value;
};

// An abstract Request constructor, used as a type in Grace.
function Request(signature, node) {
  Expression.call(this, node);

  this.parts = signature;
}

util.inherits(Request, Expression);

Request.prototype.name = buildName;

Request.prototype.toString = function () {
  return this.parts.join(" ");
};

// new UnqualifiedRequest(signature : [RequestPart])
//   A variable lookup or method request without a receiver.
function UnqualifiedRequest(signature) {
  Request.call(this, signature, signature[0]);
}

util.inherits(UnqualifiedRequest, Request);

UnqualifiedRequest.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitUnqualifiedRequest(this).then(function () {
    return acceptAll(self.parts, visitor);
  });
};

// new Request(receiver : Expression, signature : [RequestPart])
//   A method request or variable lookup.
function QualifiedRequest(receiver, signature) {
  Request.call(this, signature, receiver);

  this.receiver = receiver;
}

util.inherits(QualifiedRequest, Request);

QualifiedRequest.prototype.isBinaryOperator = function () {
  var name = this.parts[0].name;

  return name.isOperator && name.value.substring(0, 6) !== "prefix";
};

QualifiedRequest.prototype.isPrefixOperator = function () {
  var name = this.parts[0].name;

  return name.isOperator && name.value.substring(0, 6) === "prefix";
};

QualifiedRequest.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitQualifiedRequest(this).then(function () {
    return self.receiver.accept(visitor);
  }).then(function () {
    return acceptAll(self.parts, visitor);
  });
};

QualifiedRequest.prototype.toString = function () {
  var parts, receiver;

  receiver = this.receiver;
  parts = this.parts;

  if (this.isBinaryOperator()) {
    return (receiver.constructor === Request && receiver.isBinaryOperator() ?
      "(" + receiver + ")" : receiver) + " " + parts[0];
  }

  if (this.isPrefixOperator()) {
    return parts[0].name.value.substring(6) +
      (receiver.constructor === Request && receiver.isPrefixOperator() ?
        "(" + receiver + ")" : receiver);
  }

  return (receiver === null ? "" : receiver + ".") + parts.join(" ");
};

// new RequestPart(name : String,
//     generics : [Expression], arguments : [Expression])
//   A part of a request's signature.
function RequestPart(name, generics, args) {
  Node.call(this, name);

  this.name = name;
  this.generics = generics;
  this["arguments"] = args;
}

util.inherits(RequestPart, Node);

RequestPart.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitRequestPart(this).then(function () {
    return acceptAll(self.generics, visitor);
  }).then(function () {
    return acceptAll(self["arguments"], visitor);
  });
};

RequestPart.prototype.toString = function () {
  var arg, args, name;

  name = this.name;
  args = this["arguments"];

  if (name.isOperator) {
    // This can't come up unless toString is called directly on the part.
    if (name.value.substring(0, 6) === "prefix") {
      return name.value;
    }

    arg = args[0];

    if (arg.constructor === Request && arg.isBinaryOperator()) {
      args = " (" + args + ")";
    } else {
      args = " " + arg;
    }
  } else {
    args = commas("(", args, ")");
  }

  return name + commas("<", this.generics, ">") + args;
};

// new BooleanLiteral(value : Boolean)
//   A boolean literal, from a JavaScript boolean.
function BooleanLiteral(value, token) {
  Node.call(this, token);

  this.value = value;
}

util.inherits(BooleanLiteral, Expression);

BooleanLiteral.prototype.name = function () {
  return this.value.toString();
};

BooleanLiteral.prototype.accept = function (visitor) {
  return visitor.visitBooleanLiteral(this);
};

BooleanLiteral.prototype.toString = function () {
  return this.value.toString();
};

// new NumberLiteral(value : Number)
//   A number literal from a JavaScript number.
function NumberLiteral(value, token) {
  Node.call(this, token);

  this.value = value;
}

util.inherits(NumberLiteral, Expression);

NumberLiteral.prototype.accept = function (visitor) {
  return visitor.visitNumberLiteral(this);
};

NumberLiteral.prototype.toString = function () {
  return this.value.toString();
};

// new StringLiteral(value : String)
//   An object wrapping a string literal.
function StringLiteral(value, token) {
  Node.call(this, token);

  this.value = value;
}

util.inherits(StringLiteral, Expression);

StringLiteral.prototype.accept = function (visitor) {
  return visitor.visitStringLiteral(this);
};

StringLiteral.prototype.toString = function () {
  return '"' + this.value.replace(new RegExp('"', "g"), '\\"') + '"';
};

// An abstract constructor for variable declarations.
function Declaration(token) {
  Node.call(this, token);
}

util.inherits(Declaration, Node);

Declaration.prototype.patternOrIfAbsent = function (onAbsent) {
  if (this.pattern === null) {
    return onAbsent.apply();
  }

  return this.pattern;
};

Declaration.prototype.accept = function (visitor) {
  var self = this;

  return self.name.accept(visitor).then(function () {
    if (self.pattern !== null) {
      return self.pattern.accept(visitor);
    }
  }).then(function () {
    return acceptAll(self.annotations, visitor);
  }).then(function () {
    return self.value.accept(visitor);
  });
};

// new Def(name : Identifier, pattern : Expression,
//     annotations : [Expression], value : Expression)
//   A definition declaration.
function Def(name, pattern, annotations, value, token) {
  Declaration.call(this, token);

  this.name = name;
  this.pattern = pattern;
  this.annotations = annotations;
  this.value = value;
}

util.inherits(Def, Declaration);

Def.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitDef(self).then(function () {
    return Declaration.prototype.accept.call(self, visitor);
  });
};

Def.prototype.toString = function () {
  var pattern = this.pattern;

  return "def " + this.name + (pattern === null ? "" : " : " + pattern) +
    commas(" is ", this.annotations, "") + " = " + this.value;
};

// new Var(name : Identifier, pattern : Expression,
//     annotations : [Expression], value : Expression)
//   A variable declaration.
function Var(name, pattern, annotations, value, token) {
  Declaration.call(this, token);

  this.name = name;
  this.pattern = pattern;
  this.annotations = annotations;
  this.value = value;
}

util.inherits(Var, Declaration);

Var.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitVar(self).then(function () {
    return Declaration.prototype.accept.call(self, visitor);
  });
};

Var.prototype.toString = function () {
  var pattern, value;

  pattern = this.pattern;
  value = this.value;

  return "var " + this.name + (pattern === null ? "" : " : " + pattern) +
    commas(" is ", this.annotations, "") +
    (value === null ? "" : " := " + value);
};

// new ObjectConstructor(annotations : [Expression],
//     body : [Statement | Method])
//   An object constructor.
function ObjectConstructor(annotations, body, token) {
  Node.call(this, token);

  this.annotations = annotations;
  this.body = body;
}

util.inherits(ObjectConstructor, Expression);

ObjectConstructor.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitObjectConstructor(self).then(function () {
    return acceptAll(self.body, visitor);
  });
};

ObjectConstructor.prototype.toString = function () {
  var body = this.body;

  return "object" + commas(" is ", this.annotations, "") +
    " {" + (body.length === 0 ? "" : "\n  " + body.join("\n  ") + "\n") + "}";
};

// new Method(signature : Signature,
//     annotations : [Expression], body: [Statement])
function Method(signature, annotations, body, token) {
  Node.call(this, token);

  this.signature = signature;
  this.annotations = annotations;
  this.body = body;
}

util.inherits(Method, Node);

Method.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitMethod(self).then(function () {
    return self.signature.accept(visitor);
  }).then(function () {
    return acceptAll(self.annotations, visitor);
  }).then(function () {
    return acceptAll(self.body, visitor);
  });
};

Method.prototype.toString = function () {
  var body, braceSep;

  body = this.body;
  braceSep = body.length > 0 ? "\n" : "";

  return "method " + this.signature + commas(" is ", this.annotations, "") +
    " {" + braceSep + body.join("\n") + braceSep + "}";
};

// new Class(name : Identifier, signature : Signature,
//     annotations : [Expression], body : [Statement])
function Class(name, signature, annotations, body, token) {
  Node.call(this, token);

  this.name = name;
  this.signature = signature;
  this.annotations = annotations;
  this.body = body;
}

util.inherits(Class, Node);

Class.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitClass(self).then(function () {
    return self.name.accept(visitor);
  }).then(function () {
    return self.signature.accept(visitor);
  }).then(function () {
    return acceptAll(self.annotations, visitor);
  }).then(function () {
    return acceptAll(self.body, visitor);
  });
};

Class.prototype.toString = function () {
  var body, braceSep;

  body = this.body;
  braceSep = body.length > 0 ? "\n" : "";

  return "class " + this.name + "." + this.signature +
    commas(" is ", this.annotations, "") +
    " {" + braceSep + body.join("\n") + braceSep + "}";
};

// new Signature(parts : [SignaturePart], pattern : Expression)
//   A list of signature parts combined with an optional return pattern.
function Signature(parts, pattern, token) {
  Node.call(this, token);

  this.parts = parts;
  this.pattern = pattern;
}

util.inherits(Signature, Node);

Signature.prototype.name = buildName;

Signature.prototype.patternOrIfAbsent = function (onAbsent) {
  if (this.pattern === null) {
    return onAbsent.apply();
  }

  return this.pattern;
};

Signature.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitSignature(self).then(function () {
    return acceptAll(self.parts, visitor);
  }).then(function () {
    if (self.pattern !== null) {
      return self.pattern.accept(visitor);
    }
  });
};

Signature.prototype.toString = function () {
  var pattern = this.pattern;

  return this.parts.join(" ") + (pattern ? " -> " + pattern : "");
};

// new SignaturePart(name : Identifier,
//     generics : [Identifier], parameters : [Parameter])
//   A part of a method's signature.
function SignaturePart(name, generics, parameters) {
  Node.call(this, name);

  this.name = name;
  this.generics = generics;
  this.parameters = parameters;
}

util.inherits(SignaturePart, Node);

SignaturePart.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitSignaturePart(self).then(function () {
    return self.name.accept(visitor);
  }).then(function () {
    return acceptAll(self.generics, visitor);
  }).then(function () {
    return acceptAll(self.parameters, visitor);
  });
};

SignaturePart.prototype.toString = function () {
  return this.name + commas("<", this.generics, ">") +
    commas("(", this.parameters, ")");
};

// new Parameter(name : Identifier, pattern : Expression, isVarArg : Boolean)
//   A parameter in a method signature.
function Parameter(name, pattern, isVarArg, token) {
  Node.call(this, token);

  this.name = name;
  this.pattern = pattern;
  this.isVarArg = isVarArg;
}

util.inherits(Parameter, Node);

Parameter.prototype.patternOrIfAbsent = function (onAbsent) {
  if (this.pattern === null) {
    return onAbsent.apply();
  }

  return this.pattern;
};

Parameter.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitParameter(self).then(function () {
    return self.name.accept(visitor);
  }).then(function () {
    if (self.pattern !== null) {
      return self.pattern.accept(visitor);
    }
  });
};

Parameter.prototype.toString = function () {
  var pattern = this.pattern;

  return (this.isVarArg ? "*" : "") + this.name +
    (pattern === null ? "" : " : " + pattern);
};

// new Block(parameters : [Parameter], body : [Statement])
//   A block literal.
function Block(parameters, body, token) {
  Node.call(this, token);

  this.parameters = parameters;
  this.body = body;
}

util.inherits(Block, Expression);

Block.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitBlock(self).then(function () {
    return acceptAll(self.parameters, visitor);
  }).then(function () {
    return acceptAll(self.body, visitor);
  });
};

Block.prototype.toString = function () {
  var body, braceSep, newline;

  body = this.body;
  newline = body.length > 1;
  braceSep = body.length === 0 ? "" : newline ? "\n" : " ";

  return "{" + commas("", this.parameters, " ->") +
    braceSep + body.join("\n") + braceSep + "}";
};

// new Return(expression : Expression)
//   A return statement with an optional expression.
function Return(expression, token) {
  Node.call(this, token);

  this.expression = expression;
}

util.inherits(Return, Node);

Return.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitReturn(self).then(function () {
    return self.expression.accept(visitor);
  });
};

Return.prototype.toString = function () {
  var expression = this.expression;
  return "return" + (expression === null ? "" : " " + expression);
};

// new Inherits(request : Request)
//   An inherits statement with a required super-object request.
function Inherits(request, token) {
  Node.call(this, token);

  this.request = request;
}

util.inherits(Inherits, Node);

Inherits.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitInherits(self).then(function () {
    return self.request.accept(visitor);
  });
};

Inherits.prototype.toString = function () {
  return "inherits " + this.request;
};

// new Type(signatures : [Signature])
//   A type literal of method signatures.
function Type(signatures, token) {
  Node.call(this, token);

  this.signatures = signatures;
}

util.inherits(Type, Expression);

Type.prototype.nameOf = function (i) {
  return buildName.call(this.signatures[i]);
};

Type.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitType(self).then(function () {
    return acceptAll(self.signatures, visitor);
  });
};

Type.prototype.toString = function () {
  var sep, signatures;

  signatures = this.signatures;
  sep = signatures.length === 0 ? "" : " ";

  return "type {" + sep + signatures.join("; ") + sep + "}";
};

// new TypeDeclaration(name : Identifier, generics : [Type],
//     annotations : [Expression], value : Type)
//   A new type declaration.
function TypeDeclaration(name, generics, annotations, value, token) {
  Node.call(this, token);

  this.name = name;
  this.generics = generics;
  this.annotations = annotations;
  this.value = value;
}

util.inherits(TypeDeclaration, Node);

TypeDeclaration.prototype.accept = function (visitor) {
  var self = this;

  return visitor.visitTypeDeclaration(self).then(function () {
    return self.name.accept(visitor);
  }).then(function () {
    return acceptAll(self.generics, visitor);
  }).then(function () {
    return acceptAll(self.annotations, visitor);
  }).then(function () {
    return self.value.accept(visitor);
  });
};

TypeDeclaration.prototype.toString = function () {
  return "type " + this.name + commas("<", this.generics, ">") +
    commas(" is ", this.annotations, "") + " = " + this.value;
};

// new Self()
//   A reference to the local self value.
function Self(token) {
  Node.call(this, token);
}

util.inherits(Self, Expression);

Self.prototype.accept = function (visitor) {
  return visitor.visitSelf(this);
};

Self.prototype.toString = function () {
  return "self";
};

// new Super()
//   The receiver of a request on super. Only appropriate in that context: this
//   is not an expression.
function Super(token) {
  Node.call(this, token);
}

util.inherits(Super, Node);

Super.prototype.accept = function (visitor) {
  return visitor.visitSuper(this);
};

Super.prototype.toString = function () {
  return "super";
};

// new Outer()
//   The receiver of a request on outer. Only appropriate in that context: this
//   is not as expression.
function Outer(token) {
  Node.call(this, token);
}

util.inherits(Outer, Node);

Outer.prototype.accept = function (visitor) {
  return visitor.visitOuter(this);
};

Outer.prototype.toString = function () {
  return "outer";
};

exports.Node = Node;
exports.Expression = Expression;
exports.Dialect = Dialect;
exports.Identifier = Identifier;
exports.Import = Import;
exports.Request = Request;
exports.UnqualifiedRequest = UnqualifiedRequest;
exports.QualifiedRequest = QualifiedRequest;
exports.RequestPart = RequestPart;
exports.BooleanLiteral = BooleanLiteral;
exports.NumberLiteral = NumberLiteral;
exports.StringLiteral = StringLiteral;
exports.Def = Def;
exports.Var = Var;
exports.ObjectConstructor = ObjectConstructor;
exports.Signature = Signature;
exports.SignaturePart = SignaturePart;
exports.Method = Method;
exports.Class = Class;
exports.Parameter = Parameter;
exports.Block = Block;
exports.Return = Return;
exports.Inherits = Inherits;
exports.Type = Type;
exports.TypeDeclaration = TypeDeclaration;
exports.Self = Self;
exports.Super = Super;
exports.Outer = Outer;

},{"./task":19,"./util":21}],2:[function(require,module,exports){
// Defines a base visitor class for building AST visitors in Grace.

"use strict";

var ast, defs, prim, rt, util, visitor;

ast = require("../ast");
rt = require("../runtime");
defs = require("../runtime/definitions");
prim = require("../runtime/primitives");
util = require("../util");

function Visitor() {}

util.inherits(Visitor, prim.Object);

function visit(node) {
  return this.visitNode(node);
}

util.forProperties(ast, function (name) {
  name = "visit" + name;

  Visitor.prototype[name] = rt.method(name, 1, visit);
});

Visitor.prototype.visitNode = rt.method("visitNode", 1, function () {
  return defs.bool(true);
});

function EmptyVisitor() {}

util.inherits(EmptyVisitor, Visitor);

EmptyVisitor.prototype.visitNode = rt.method("visitNode", 1, function () {
  return defs.bool(false);
});

visitor = defs.object();

function makeConstructor(name, Ctor) {
  visitor[name] = rt.constructor(name, 0, function (inheritor) {
    if (inheritor === null) {
      return new Ctor();
    }

    util.extend(inheritor, Ctor.prototype);

    return inheritor;
  });
}

makeConstructor("base", Visitor);
makeConstructor("empty", EmptyVisitor);

module.exports = visitor;

},{"../ast":1,"../runtime":10,"../runtime/definitions":11,"../runtime/primitives":16,"../util":21}],3:[function(require,module,exports){
// The core module of the library, exposing an interpreter that takes Grace code
// and executes it. It also exposes the constructor for the underlying
// Interpreter object, which allows for the preservation of state between
// multiple executions.

"use strict";

var Task, interpreter, loader, parser, rt, util;

parser = require("./parser");
Task = require("./task");
util = require("./util");

function parseAndHandle(text, path) {
  return parser.parse(text).then(null, function (error) {
    if (error instanceof parser.ParseError) {
      return rt.ParseFailure.raise(rt.string(error.message))
        .then(null, function (packet) {
          packet.object.stackTrace = [
            rt.trace(null, null, {
              "module": path,
              "line": error.line,
              "column": error.column
            })
          ];

          throw packet;
        });
    }

    return rt.InternalError.raiseFromPrimitiveError(error);
  });
}

function CheckResult(isSuccess, name, result, line, column) {
  this.isSuccess = isSuccess;
  this.name = name;

  if (isSuccess) {
    this.value = result;
  } else {
    this.message = result;
    this.line = line;
    this.column = column;
  }
}

CheckResult.prototype.toString = function () {
  return this.name + (this.message ? ": " + this.message : "");
};

// new Interpreter(preludeGen : Task<Object> | Object = <sys>,
//     moduleLoader : Function<Interpreter, Path, Callback<Object>> = <fs>)
//   A new interpreter, with internal state preserved between executions. The
//   prelude generator may either be a task to build the prelude object, or just
//   the object itself.
function Interpreter(preludeGen, moduleLoader) {
  var self = this;

  if (moduleLoader === undefined && typeof preludeGen === "function") {
    moduleLoader = preludeGen;
    preludeGen = rt.prelude;
  }

  this.prelude = Task.resolve(preludeGen || rt.prelude);
  moduleLoader = moduleLoader || loader.defaultLoader;

  self.prelude.then(function (prelude) {
    self.interpreter = new interpreter.Interpreter(prelude,
      function (path, callback) {
        moduleLoader.apply(null, [ self, path, callback ]);
      });
  });
}

function makeInterpret(method, optionalPath, parse, onSuccess, onFailure) {
  return function (path, code, callback) {
    var self = this;

    if (optionalPath && typeof code !== "string") {
      callback = code;
      code = path;
      path = null;
    }

    function next(ast) {
      return self.prelude.then(function () {
        delete self.interpreter.modulePath;

        if (path !== null) {
          self.interpreter.modulePath = path;
        }

        return self.interpreter[method](ast, path);
      });
    }

    return (util.isArray(code) ? next(code) : parse(code, path).then(next))
      .then(onSuccess || null, onFailure || null).callback(callback).stopify();
  };
}

// interpret(path : Path = undefined,
//     code : String, callback : Callback<Object>) -> Function<Boolean>
//   Interpret Grace code with the existing state of this interpreter, returning
//   the result of the final expression. Takes an optional module path that will
//   be used to report problems. Returns a function that will attempt to stop
//   the execution when called.
Interpreter.prototype.interpret =
  makeInterpret("interpret", true, parseAndHandle);

// check(path : Path = undefined,
//     code : String, callback : Callback<StaticError>) -> Function<Boolean>
//   Parse and check the given code, returning an object with information about
//   the problem if the code fails to parse or fails its check. Takes an
//   optional module path that will be used to report problems. Returns a
//   function that will attempt to stop the execution when called.
Interpreter.prototype.check =
  makeInterpret("check", true, parser.parse, function (result) {
    if (util.isArray(result)) {
      return new CheckResult(true, "Success", result);
    }

    return result.message().then(function (message) {
      return message.asPrimitiveString();
    }).then(function (message) {
      var location, node;

      node = result.object.node;
      location = node && node.location;

      return new CheckResult(false, "Checker Failure",
        message, location && location.line, location && location.column);
    });
  }, function (packet) {
    if (packet instanceof parser.ParseError) {
      return new CheckResult(false, "Parse Failure",
        packet.message, packet.line, packet.column);
    }

    throw packet;
  });

// module(path : Path, code : String,
//     callback : Callback<Object>) -> Function<Boolean>
//   Interpret Grace code as a module body and cache it based on the given path
//   so a request for the same module does not occur again. Returns a function
//   that will attempt to stop the execution when called.
Interpreter.prototype.module =
  makeInterpret("module", false, parseAndHandle);

// load(path : Path, callback : Callback<Object>) -> Function<Boolean>
//   Run the interpreter module loader on the given path. Returns a function
//   that will attempt to stop the execution when called.
Interpreter.prototype.load = function (path, callback) {
  var self = this;

  return self.prelude.then(function () {
    return self.interpreter.load(path);
  }).callback(callback).stopify();
};

// enter(Callback<Object> = null)
//   Enter into an object scope and stay in that state, passing the newly
//   created self value to the given callback. This is useful for implementing
//   an interactive mode.
Interpreter.prototype.enter = function (callback) {
  var self = this;

  self.prelude.then(function () {
    return self.interpreter.enter();
  }).callback(callback);
};

function buildAndApply(method, args) {
  var built, len, required;

  function Build() {
    Interpreter.apply(this, util.slice(args, required, len));
  }

  Build.prototype = Interpreter.prototype;

  required = typeof args[1] === "string" || util.isArray(args[1]) ? 2 : 1;

  len = args.length - 1;
  built = new Build();
  return built[method].apply(built,
    util.slice(args, 0, required).concat([ args[len] ]));
}

exports.Interpreter = Interpreter;

// interpret(path : Path = undefined, code : String, prelude : Object = <sys>,
//     moduleLoader : Function<Interpreter, Path, Callback<Object>> = <fs>,
//     callback : Callback<Object>)
//   Interpret Grace code standalone.
exports.interpret = function () {
  return buildAndApply("interpret", arguments);
};

// check(path : Path = undefined, code : String, prelude : Object = <sys>,
//     moduleLoader : Function<Interpreter, Path, Callback<Object>> = <fs>,
//     callback : Callback<Object>)
//   Check Grace code standalone.
exports.check = function () {
  return buildAndApply("check", arguments);
};

// module(path : Path, code : String, prelude : Object = <sys>,
//     moduleLoader : Function<Interpreter, Path, Callback<Object>> = <fs>,
//     callback : Callback<Object>)
//   Interpret Grace code standalone as a module body and cache it based on the
//   given path so a request for the same module does not occur again.
exports.module = function () {
  return buildAndApply("module", arguments);
};

// load(path : Path, prelude : Object = <sys>,
//     moduleLoader : Function<Interpreter, Path, Callback<Object>> = <fs>,
//     callback : Callback<Object>)
//   Run a new interpreter with a module loader on the given path.
exports.load = function () {
  return buildAndApply("load", arguments);
};

rt = require("./runtime");
interpreter = require("./interpreter");

loader = require("./loader");

exports.Task = Task;
exports.runtime = rt;
exports.defaultLoader = loader.defaultLoader;
exports.prelude = rt.prelude;

util.extend(exports, parser);

},{"./interpreter":4,"./loader":5,"./parser":6,"./runtime":10,"./task":19,"./util":21}],4:[function(require,module,exports){
(function (global){
// The Grace interpreter. Exposes both the Interpreter constructor and the
// helper function 'interpret' which executes on an anonymous Interpreter.
//
// Almost every function in the interpreter runs asynchronously, taking a
// callback as its last argument that expects an error and a result as its
// parameters. This asynchronous behaviour allows the interpreter to take
// single-tick breaks on each method request, freeing up the event loop.
// Standard JavaScript functions can be marked as asynchronous by attaching an
// 'asynchronous' property with a truthy value to the function. All functions
// built by the interpreter from Method nodes in the AST are asynchronous by
// default, but a user will be able to disable this in the future with an
// annotation (this functionality is necessary for interacting with standard
// JavaScript).
//
// The asynchronous behaviour of the whole interpreter can be turned off
// wholesale by passing false to the constructor or by setting the
// 'asynchronous' property to false. The interface will still asynchronous, but
// the 'asynchronous' property of functions will be ignored and the interpreter
// will not take single-tick breaks. This can also be achieved with the
// 'interpret' helper by simply not passing a callback.

"use strict";

var Task, ast, path, rt, util;

path = require("path");

Task = require("./task");
ast = require("./ast");
rt = require("./runtime");
util = require("./util");

// new Interpreter(prelude : Object,
//     moduleLoader : Function<Path, Callback<Object>>)
//   A new interpreter, with internal state preserved between executions.
function Interpreter(prelude, moduleLoader) {
  util.makeCloneable(this, "scope");

  this.modules = {};
  this.load = Task.taskify(this, moduleLoader);

  this.scope = {
    "outer": null,
    "self": prelude
  };
}

// Interprets a list of AST nodes asynchronously, passing the result of
// interpreting the final node in the list (or done, if the list is empty).
Interpreter.prototype.interpret = function (nodes) {
  function handleObject() {
    var context, isConfidential, method, name, outer;

    if (this.scope.object &&
        (nodes.length === 0 || nodes[0].constructor !== ast.Inherits)) {
      delete this.scope.object;

      context = this.self();

      for (name in context) {
        if (typeof context[name] === "function") {
          method = context[name];

          isConfidential = method.isConfidential;

          while (util.owns(method, "super")) {
            method = method["super"];

            if (method.isConfidential) {
              isConfidential = true;
            } else if (isConfidential) {
              name = rt.string(method.identifier);
              return rt.InvalidMethod.raiseConfidentialOverrideForName(name);
            }
          }
        }
      }

      if (context.asString === rt.base.asString) {
        outer = this.searchScope("self", true);
        method = this.searchScope("method", true);

        if (method !== null) {
          name = method.identifier;

          context.asString = rt.method("asString", 0, function () {
            return outer.asString().then(function (string) {
              return string.asPrimitiveString().then(function (pstring) {
                return rt.string("object(" + pstring + "." + name + ")");
              });
            });
          });
        } else if (this.modulePath !== undefined) {
          name = this.modulePath;

          context.asString = rt.method("asString", 0, function () {
            return rt.string("object(" + name + ")");
          });
        }
      }
    }

    return this.resolve(rt.done);
  }

  if (nodes.length === 0) {
    return handleObject.call(this);
  }

  return this.imports(nodes).then(function () {
    // Methods and variables are hoisted to the top of their scope.
    return this.each(nodes, function (node) {
      var constructor = node.constructor;

      if (constructor === ast.Method || constructor === ast.Class) {
        return this.evaluate(node);
      }

      if (constructor === ast.Def || constructor === ast.Var) {
        return this.putVariable(node, rt.pattern(function () {
          // It's an error to assign to a hoisted var before its actual
          // location in code has been reached.
          return rt.UndefinedValue.raiseForName(rt.string(node.name.value));
        }));
      }
    });
  }).then(function () {
    return this.decls(nodes);
  }).then(function () {
    return this.annotations(nodes);
  }).then(handleObject).then(function () {
    return this.each(nodes, function (node) {
      // Imports, methods, and types have already been hoisted. Variables still
      // need their contents to be evaluated.
      if (node.constructor !== ast.Dialect &&
          node.constructor !== ast.Import &&
          node.constructor !== ast.Method &&
          node.constructor !== ast.Class &&
          node.constructor !== ast.TypeDeclaration) {
        return this.evaluate(node);
      }

      return rt.done;
    });
  }).then(function (results) {
    return results.pop();
  });
};

// Enter into an object scope and stay in that state, returning the newly
// created self value. This is useful for an interactive mode.
Interpreter.prototype.enter = function () {
  var object = rt.object();
  this.push(object);
  return object;
};

// Interpret a list of nodes as a module body and cache it based on a path so a
// request for the same module does not occur again.
Interpreter.prototype.module = function (nodes, key) {
  var interpreter, module;

  key = path.normalize(key);
  interpreter = this.clone();
  interpreter.modulePath = key;

  module = rt.object();

  module.asString = rt.method("asString", 0, function () {
    return rt.string(key);
  });

  return interpreter.objectBody(nodes, module).bind(this).then(function () {
    this.modules[path.normalize(key)] = module;
    return module;
  }, rt.handleInternalError);
};

Interpreter.prototype.evaluate = function (node) {
  var constructor = node.constructor;

  if (constructor === ast.Method) {
    return this.method(node);
  }

  if (constructor === ast.Class) {
    return this["class"](node);
  }

  if (constructor === ast.Def || constructor === ast.Var) {
    return this.variable(node, false);
  }

  if (constructor === ast.Return) {
    return this["return"](node);
  }

  if (constructor === ast.Inherits) {
    return this.inherits(node);
  }

  return this.expression(node);
};

Interpreter.prototype.expression = function (node) {
  var constructor = node.constructor;

  if (constructor === ast.UnqualifiedRequest ||
      constructor === ast.QualifiedRequest) {
    return this.request(node);
  }

  if (constructor === ast.Self) {
    if (this.scope.object) {
      return rt.IncompleteObject.raiseForSelf()
        .bind(this).then(null, function (packet) {
          return this.report(packet, "self", null, node);
        });
    }

    return this.resolve(this.searchScope("self"));
  }

  if (constructor === ast.ObjectConstructor) {
    return this.object(node);
  }

  if (constructor === ast.Block) {
    return this.task(function () {
      return this.block(node);
    });
  }

  if (constructor === ast.Type) {
    return this.type(node);
  }

  if (constructor === ast.BooleanLiteral) {
    return this.bool(node);
  }

  if (constructor === ast.NumberLiteral) {
    return this.number(node);
  }

  if (constructor === ast.StringLiteral) {
    return this.string(node);
  }

  return this.raise("Unrecognised node of type " + constructor.name);
};

Interpreter.prototype.inheriting = function (node, inheriting) {
  var constructor = node.constructor;

  if (constructor === ast.UnqualifiedRequest ||
      constructor === ast.QualifiedRequest) {
    return this.request(node, inheriting);
  }

  if (constructor === ast.BooleanLiteral) {
    return this.bool(node, inheriting);
  }

  return this.raise(rt.string("Unrecognised node of type " +
      constructor.name + " in inheritance")).bind(this);
};

Interpreter.prototype.imports = function (nodes) {
  return this.each(nodes, function (node) {
    var constructor = node.constructor;

    if (constructor === ast.Dialect) {
      return this.dialect(node, nodes);
    }

    if (constructor === ast.Import) {
      return this["import"](node);
    }
  });
};

Interpreter.prototype.check = function (nodes) {
  var name;

  if (nodes.length > 0 && nodes[0].constructor === ast.Dialect) {
    name = nodes[0].path.value;

    return this.dialect(nodes[0], nodes).then(function () {
      return nodes;
    }, function (packet) {
      if (packet instanceof rt.CheckerFailure.object.Packet &&
          packet.object.module === name) {
        return packet;
      }

      throw packet;
    });
  }

  return Task.resolve(nodes);
};

Interpreter.prototype.dialect = function (node, nodes) {
  var name = node.path.value;

  return this.load(name).bind(this).then(function (module) {
    return this.task(function () {
      if (typeof module.check === "function") {
        return module.check(rt.list(nodes));
      }
    }).then(function () {
      this.scope.outer = {
        "outer": null,
        "self": module
      };
    }, function (packet) {
      var object = packet.object;

      if (packet instanceof rt.CheckerFailure.object.Packet &&
          object.module === undefined) {
        object.stackTrace = [];
        object.module = name;

        if (object.node) {
          return this.reportNode(packet, object.node);
        }
      }

      throw packet;
    });
  }).then(null, function (packet) {
    return this.report(packet, 'dialect "' + node.path.value + '"', null, node);
  });
};

Interpreter.prototype["import"] = function (node) {
  return this.load(node.path.value).bind(this).then(function (module) {
    var name = node.identifier.value;

    if (name !== "_") {
      return this.put(name, this.newVar(name, module), node);
    }
  }, function (packet) {
    return this.report(packet, 'import "' + node.path.value + '"', null, node);
  });
};

Interpreter.prototype.annotations = function (nodes) {
  return this.each(nodes, function (node) {
    return this.task(function () {
      var scope = this.scope;

      function getDefinition(name) {
        return scope[name || node.name.value];
      }

      if (node.constructor === ast.TypeDeclaration ||
          node.constructor === ast.Def || node.constructor === ast.Class) {
        return this.annotate([ getDefinition() ], node.annotations,
          node.constructor === ast.Def ? "Def" :
              node.constructor === ast.Class ? "Class" : "Type");
      }

      if (node.constructor === ast.Method) {
        return this
          .annotate([ getDefinition(util.uglify(node.signature.name())) ],
            node.annotations, "Method");
      }

      if (node.constructor === ast.Var) {
        return this.annotate([
          getDefinition(),
          getDefinition(node.name.value + ":=")
        ], node.annotations, "Var");
      }
    }).then(null, function (packet) {
      return this.reportNode(packet, node);
    });
  });
};

Interpreter.prototype.annotate = function (values, annotations, name) {
  return this.each(annotations, function (annNode) {
    return this.expression(annNode).then(function (annotation) {
      return this.assert(annotation, rt[name + "Annotator"])
        .then(function () {
          return this.apply(annotation, "annotate" + name, [ values ]);
        });
    });
  });
};

Interpreter.prototype.object = function (node, inheriting) {
  return this.objectBody(node.body, inheriting).then(function (object) {
    // This is the only set of annotations that is evaluated at the point where
    // it appears in the code. All other annotations are hoisted.
    return this.annotate([ object ], node.annotations, "Object")
      .then(function () {
        return object;
      });
  }).then(null, function (packet) {
    return this.report(packet, "object", null, node);
  });
};

Interpreter.prototype.objectBody = function (body, inheriting) {
  var object = inheriting || rt.object();

  return this.scoped(object, function () {
    this.scope.object = true;

    return this.interpret(body);
  }).then(function () {
    return object;
  });
};

Interpreter.prototype.block = function (node) {
  var block, interpreter, parameter, parameters, patternNode, signature;

  parameters = node.parameters;
  signature = new ast.Signature([
    new ast.SignaturePart(new ast.Identifier("apply", false, node),
      [], parameters)
  ], null, node);

  interpreter = this.clone();

  block = rt.block([ 0, parameters.length ], function () {
    var args = [ util.slice(arguments) ];

    return interpreter.clone().scoped(function () {
      return this.parts(signature, args, node).then(function () {
        return this.interpret(node.body);
      });
    });
  });

  if (parameters.length === 1) {
    parameter = parameters[0];
    patternNode = parameter.pattern;

    if (patternNode !== null) {
      block.match = rt.method("match()", 1, function (object) {
        return interpreter.pattern(patternNode).then(function (pattern) {
          return pattern.match(object).then(function (match) {
            return match.andAlso(rt.block(0, function () {
              // Reimplement apply(), without testing the pattern.
              return interpreter.clone().scoped(function () {
                var name = parameter.name.value;

                return this.task(function () {
                  if (name !== "_") {
                    return this.put(name, this.newVar(name, object), parameter);
                  }
                }).then(function () {
                  return this.interpret(node.body).then(function (result) {
                    return rt.success(result, block);
                  });
                });
              });
            }));
          });
        });
      });
    }
  }

  return block;
};

Interpreter.prototype.assert = function (value, pattern) {
  if (pattern !== rt.Unknown) {
    return this.apply(pattern, "assert()", [ [ value ] ]);
  }

  return this.resolve(null);
};

Interpreter.prototype.decls = function (nodes) {
  return this.each(nodes, function (node) {
    var name;

    if (node.constructor === ast.TypeDeclaration) {
      name = node.name.value;

      return this.put(name, this.newType(name, node.generics.length), node)
        .then(function () {
          return node;
        });
    }
  }).then(function (declNodes) {
    return this.each(declNodes, this.decl).then(function (decls) {
      return this.each(declNodes, decls, this.putDecl);
    }).then(function () {
      return this.each(declNodes, function (node) {
        if (this.scope[node.name.value].value.object.become) {
          return rt.InvalidType
            .raiseSelfDependencyForType(rt.string(node.name.value))
            .bind(this).then(null, this.reportDecl(node));
        }
      });
    });
  });
};

Interpreter.prototype.decl = function (node) {
  function evaluate() {
    if (node.value.constructor === ast.Type) {
      return this.type(node.value, node.name.value);
    }

    return this.expression(node.value);
  }

  return this.task(function () {
    if (node.generics.length !== 0) {
      // TODO Build a better semantics for recursive types.
      return this.scoped(function () {
        return this.each(node.generics, function (parameter) {
          var name = parameter.value;
          return this.put(name, this.newVar(name, rt.Unknown), node);
        }).then(evaluate);
      });
    }

    return evaluate.call(this);
  }).then(null, this.reportDecl(node));
};

Interpreter.prototype.putDecl = function (node, pattern) {
  // TODO Should assert that the value is statically known, not just
  // that it is a pattern.
  return this.assert(pattern, rt.Pattern).then(function () {
    // We need to retain the references of the hoisted values, so we
    // need to copy the properties of the resulting expression into
    // the referenced value.
    var decl, proxy;

    // This is safe because types cannot be overridden.
    decl = this.scope[node.name.value];
    proxy = decl.value;

    return proxy.object.become(pattern);
  }).then(null, this.reportDecl(node));
};

Interpreter.prototype.reportDecl = function (node) {
  return function (packet) {
    var trace;

    // Remove the report about the anonymous type when it appears directly in a
    // type alias declaration.
    if (typeof packet.object === "object") {
      trace = packet.object.stackTrace;
      if (trace.length > 0 && trace[0].name === "type") {
        trace.shift();
      }
    }

    return this.report(packet, "type " + node.name.value, null, node);
  };
};

Interpreter.prototype.type = function (node, decl) {
  var i, j, l, name, names, nsignatures, tsignatures;

  function report(packet) {
    return this.report(packet, "type", null, node);
  }

  nsignatures = node.signatures;
  names = [];
  tsignatures = [];

  for (i = 0, l = nsignatures.length; i < l; i += 1) {
    name = node.nameOf(i);

    for (j = 0; j < i; j += 1) {
      if (names[j] === name) {
        decl = decl === undefined ? node : rt.string(decl);

        return rt.InvalidType
          .raiseDuplicateMethodName_inType([ rt.string(name) ], [ decl ])
          .bind(this).then(null, report);
      }
    }

    names.push(name);

    tsignatures.push(this.typeSignature(nsignatures[i]));
  }

  return this.resolve(rt.type(tsignatures));
};

Interpreter.prototype.typeSignature = function (signature) {
  var generics, hasVarArg, i, l, parameters, part, parts;

  function getValue(node) {
    return node.value;
  }

  function getName(node) {
    if (node.isVarArg) {
      hasVarArg = true;
      return "*" + node.name.value;
    }

    return node.name.value;
  }

  parts = [];

  for (i = 0, l = signature.parts.length; i < l; i += 1) {
    hasVarArg = false;
    part = signature.parts[i];
    generics = util.map(part.generics, getValue);
    parameters = util.map(part.parameters, getName);

    parts.push(rt.sigPart(part.name.value, hasVarArg, generics, parameters));
  }

  return rt.signature(parts);
};

Interpreter.prototype.bool = function (node, inheriting) {
  var method = rt[node.value ? "mtrue" : "mfalse"];

  if (inheriting !== undefined) {
    return this.inherit(null, method, inheriting);
  }

  return method().bind(this);
};

Interpreter.prototype.number = function (node) {
  return this.resolve(rt.number(node.value));
};

Interpreter.prototype.string = function (node) {
  return this.resolve(rt.string(node.value));
};

// Handles both synchronous and asynchronous requests.
Interpreter.prototype.apply = function () {
  return rt.apply.apply(null, arguments).bind(this);
};

// Handles both synchronous and asynchronous inherit requests.
Interpreter.prototype.inherit = function () {
  return rt.inherit.apply(null, arguments).bind(this);
};

Interpreter.prototype.request = function (node, inheriting) {
  var name, pretty;

  pretty = node.name();
  name = util.uglify(pretty);

  return this.task(function () {
    if (node.constructor === ast.UnqualifiedRequest) {
      return this.unqualifiedRequest(node, name, pretty);
    }

    return this.qualifiedRequest(node, name, pretty);
  }).then(function (pair) {
    var method, receiver;

    receiver = pair[0];
    method = pair[1];

    return this.each(node.parts, function (part) {
      if (method.isVariable && part.generics.length > 0) {
        return rt.InvalidRequest.raiseGenericsForVariable(rt.string(name));
      }

      return this.each(part.generics, function (param) {
        return this.expression(param);
      }).then(function (generics) {
        if (part["arguments"].length > 0) {
          if (method.isVariable) {
            return rt.InvalidRequest.raiseArgumentsForVariable(rt.string(name));
          }

          if (method.isStatic) {
            return rt.InvalidRequest.raiseArgumentsForType(rt.string(name));
          }
        }

        return this.each(part["arguments"], this.expression)
          .then(function (args) {
            args.generics = generics;
            return args;
          });
      });
    }).then(function (args) {
      return this.task(function () {
        if (inheriting !== undefined) {
          return this.inherit(receiver, method, inheriting, args);
        }

        return this.apply(receiver, method, args);
      }).then(null, rt.handleInternalError).then(null, function (packet) {
        if (node.constructor === ast.QualifiedRequest &&
            node.receiver.constructor === ast.Super) {
          receiver = "super";
        }

        packet.object.stackTrace.pop();
        return this.report(packet, pretty, receiver, node);
      });
    });
  });
};

Interpreter.prototype.unqualifiedRequest = function (node, name, pretty) {
  return this.search(name).then(function (pair) {
    var l, rec, ref;

    if (pair === null) {
      // Produce a more specific error message for missing assignment.
      l = name.length - 2;
      if (name.substring(l) === ":=") {

        // The pretty name has a space in it that moves the index to split
        // at forward by one, but the increased length of the total string
        // means that 'l' is still the correct index.
        pretty = rt.string(pretty.substring(0, l));

        return this.search(name.substring(0, l)).then(function (found) {
          if (found === null) {
            return rt.UnresolvedRequest
              .raiseForAssignToUnresolvedName(pretty);
          }

          return rt.UnresolvedRequest.raiseForAssignToName(pretty);
        });
      }

      return rt.UnresolvedRequest.raiseForName(rt.string(pretty));
    }

    rec = pair[0];
    ref = pair[1];

    if (rec !== null && this.scope.object &&
        rec === this.searchScope("self") && !util.owns(ref, "value")) {
      return rt.IncompleteObject.raiseForName(rt.string(pretty));
    }

    return pair;
  }).then(null, function (packet) {
    return this.report(packet, pretty, null, node);
  });
};

Interpreter.prototype.qualifiedRequest = function (node, name, pretty) {
  var context, method, rnode, sup;

  rnode = node.receiver;

  if (rnode.constructor === ast.Super) {
    sup = this.searchScope("super", false);
    context = this.searchScope("self");

    return this.task(function () {
      if (sup !== null) {
        if (util.owns(sup, name)) {
          // This super is attempting to request the method above the one that
          // was defined when this scope was first entered.
          method = sup[name]["super"];
        } else {
          // No method with that name had appeared in the object when the
          // inheritance at this level ocurred. Attempt to recover by pulling
          // the method directly out of self: if it appears there, then it
          // must have been defined further up the inheritance chain, so it's
          // safe to say it's a super method.
          method = context[name];
        }
      }

      if (method === undefined) {
        // Either the method didn't appear on the object at all, or there was
        // no overridden method to request.
        return rt.UnresolvedSuperRequest
          .raiseForName_inObject([ rt.string(pretty) ], [ context ]);
      }

      return [ context, method ];
    }).bind(this).then(null, function (packet) {
      return this.report(packet, pretty, "super", node);
    });
  }

  if (rnode.constructor === ast.Outer) {
    method = this.searchScope(name, true);

    if (method === null) {
      return rt.UnresolvedRequest.raiseForName(rt.string(pretty))
        .bind(this).then(null, function (packet) {
          return this.report(packet, pretty, "outer", node);
        });
    }

    return [ null, method ];
  }

  return this.expression(rnode).then(function (receiver) {
    return rt.lookup(receiver, pretty, rnode.constructor === ast.Self)
      .bind(this).then(function (foundMethod) {
        return [ receiver, foundMethod ];
      }, function (packet) {
        return this.report(packet, pretty, receiver, node);
      });
  });
};

Interpreter.prototype["class"] = function (node) {
  var object = rt.object();

  return this.scoped(object, function () {
    return this.method(node);
  }).then(function () {
    var def, name, string;

    name = node.name.value;
    def = this.newVar(name, object, true);
    string = rt.string(name);

    object.asString = rt.method("asString", 0, function () {
      return string;
    });

    return this.put(name, def, node);
  });
};

Interpreter.prototype.method = function (node) {
  var body, constructor, init, interpreter, last, method, pretty, signature;

  pretty = node.signature.name();
  signature = node.signature;
  body = node.body;

  // Save the state of the surrounding scope at the point where the method
  // is defined.
  interpreter = this.clone();

  function buildMethod(isInherits, func) {
    return function (inheriting) {
      var argParts, clone;

      argParts = util.slice(arguments, isInherits ? 1 : 0);

      if (signature.parts.length === 1) {
        argParts = [ argParts ];
      }

      // Reclone the interpreter to get a unique scope for this execution.
      clone = interpreter.clone();
      if (this !== null && this !== global && this !== clone.scope.self) {
        clone.scope.self = this;
      }

      return clone.scoped(function () {
        return new Task(this, function (resolve, reject) {
          this.parts(signature, argParts, node).then(function (pattern) {
            var exit, top;

            // Ensures that the postcondition of the method holds before
            // exiting the method.
            exit = function (value) {
              top["return"] = function () {
                return rt.InvalidReturn
                  .raiseForCompletedMethod(rt.string(pretty));
              };

              this.assert(value, pattern).then(function () {
                resolve(value);
              }, function (packet) {
                return this.reportNode(packet, signature.pattern)
                  .then(null, reject);
              });

              return new Task(function () {
                return;
              });
            };

            top = this.scope;
            top["return"] = exit;
            top.method = method;

            return func.call(this, inheriting).bind(this).then(exit, reject);
          }, reject);
        });
      }).bind(null);
    };
  }

  return this.signature(signature, pretty).then(function (parts) {
    method = rt.method(pretty, parts,
      buildMethod(false, node.constructor === ast.Class ? function () {
        return this.objectBody(body).bind(null);
      } : function () {
        return this.interpret(body).bind(null);
      }));

    // Build inheritance mechanism.
    if (node.constructor === ast.Class) {
      method.inherit = rt.inheritor(pretty, parts,
        buildMethod(true, function (inheriting) {
          return this.objectBody(body, inheriting);
        }));
    } else if (body.length > 0) {
      last = body[body.length - 1];
      constructor = last.constructor;

      if (constructor === ast.Return) {
        last = last.expression;

        if (last !== null) {
          constructor = last.constructor;
        }
      }

      if (constructor === ast.ObjectConstructor) {
        body = body.concat();
        body.pop();
        init = body;
        body = init.concat([ last ]);

        method.inherit = rt.inheritor(pretty, parts,
          buildMethod(true, function (inheriting) {
            return this.interpret(init).then(function () {
              return this.object(last, inheriting);
            });
          }));
      }
    }

    // Put the resulting method in the local scope and run annotations.
    return this.put(pretty, method, node);
  });
};

// Process a method signature into a runtime parameter count list.
Interpreter.prototype.signature = function (signature, pretty) {
  var hasVarArg, i, j, k, l, param, params, part, parts;

  function report(packet) {
    return this.report(packet, "method", null, part);
  }

  parts = [];

  for (i = 0, l = signature.parts.length; i < l; i += 1) {
    part = signature.parts[i];
    params = part.parameters;
    hasVarArg = false;

    for (j = 0, k = params.length; j < k; j += 1) {
      param = params[j];
      if (param.isVarArg) {
        if (hasVarArg) {
          return rt.InvalidMethod
            .raiseMultipleVariadicParametersForName(rt.string(pretty))
            .bind(this).then(null, report);
        }

        hasVarArg = true;
      }
    }

    parts.push([
      part.generics.length,
      hasVarArg ? rt.gte(params.length - 1) : params.length
    ]);
  }

  return this.resolve(parts);
};

// Handle the joining of a method and a request by adding generics, evaluating
// patterns, and adding parameters, then producing the return pattern.
Interpreter.prototype.parts = function (msig, rsig, node) {
  return this.each(msig.parts, rsig, function (mpart, rpart) {
    return this.part(mpart, rpart, node);
  }).then(function () {
    return this.pattern(msig.pattern);
  });
};

// Handle the joining of individual parts of a method and a request.
Interpreter.prototype.part = function (mpart, rpart, node) {
  var genLength = mpart.generics.length;

  // Add generics, and test if they are patterns.
  return this.generics(mpart.generics, rpart.slice(0, genLength), node)
    .then(function () {
      return this.parameters(mpart.parameters, rpart.slice(genLength), node);
    });
};

// Join a method's generic parameters with the values given by a request.
Interpreter.prototype.generics = function (mgens, rgens, node) {
  return this.each(mgens, rgens, function (mgen, rgen) {
    if (mgen.value !== "_") {
      return this.put(mgen.value, this.newVar(mgen.value, rgen), node);
    }
  });
};

// Evaluate a method part's parameters and join them with part of a request.
Interpreter.prototype.parameters = function (params, args, node) {
  return this.each(params, function (param, i) {
    var varArgSize = args.length - params.length + 1;
    if (param.isVarArg) {
      args.splice(i, 0, rt.list(args.splice(i, varArgSize)));
    }
  }).then(function () {
    return this.patterns(params).then(function (patterns) {
      return this.each(params, function (param) {
        return param.name.value;
      }).then(function (names) {
        return this.args(names, patterns, args, node);
      });
    });
  });
};

// Evaluate a method part's patterns in the scope of its generic arguments.
Interpreter.prototype.patterns = function (parameters) {
  return this.each(parameters, function (parameter) {
    var name = parameter.name.value;

    return this.pattern(parameter.pattern).then(function (pattern) {
      return rt.named(name,
        parameter.isVarArg ? rt.listOf(pattern) : pattern);
    });
  });
};

Interpreter.prototype.pattern = function (expression) {
  if (expression === null) {
    // No pattern given, default to Unknown.
    return this.resolve(rt.Unknown);
  }

  return this.expression(expression).then(function (pattern) {
    // Check that it's actually a pattern.
    return this.assert(pattern, rt.Pattern).then(function () {
      return pattern;
    });
  });
};

// Join parameters and arguments together.
Interpreter.prototype.args = function (names, patterns, args, node) {
  return this.each(names, patterns, args, function (name, pattern, arg) {
    return this.assert(arg, pattern).then(function () {
      if (name !== "_") {
        return this.put(name, this.newVar(name, arg), node);
      }
    });
  });
};

Interpreter.prototype.variable = function (node) {
  return this.pattern(node.pattern).then(function (pattern) {
    var name, variable;

    name = node.name.value;
    variable = this.scope[name];

    while (!variable.isVariable) {
      variable = variable["super"];
    }

    variable.pattern = pattern;

    if (node.value !== null) {
      return this.expression(node.value).then(function (value) {
        return this.assert(value, pattern).then(function () {
          variable.value = value;
        });
      });
    }
  }).then(function () {
    return rt.done;
  }, function (packet) {
    return this.reportNode(packet, node);
  });
};

Interpreter.prototype.putVariable = function (node, pattern) {
  var name, variable;

  name = node.name.value;
  variable = this.newVar(name);

  return this.put(name, variable, node).then(function () {
    var self, setter;

    if (node.constructor === ast.Var) {
      self = this;
      variable.pattern = pattern;

      setter = rt.method(name + " :=", 1, function (value) {
        return self.assert(value, variable.pattern).then(function () {
          variable.value = value;
          return rt.done;
        });
      });

      setter.isConfidential = true;

      return this.put(name + " :=", setter, node);
    }
  }).then(function () {
    return variable;
  });
};

Interpreter.prototype["return"] = function (node) {
  var exprNode = node.expression;

  return this.task(function () {
    if (exprNode === null) {
      return rt.done;
    }

    return this.expression(exprNode);
  }).then(function (expression) {
    var exit = this.searchScope("return", false);

    if (exit === null) {
      return rt.InvalidReturn.raiseInsideOfObject();
    }

    return exit.call(this, expression).bind(this);
  }).then(null, function (packet) {
    return this.report(packet, "return", null, node);
  });
};

Interpreter.prototype.inherits = function (node) {
  var context, sup;

  context = this.self();
  sup = {};

  util.forProperties(context, function (name, method) {
    while (method["super"] !== undefined) {
      method = method["super"];
    }

    sup[name] = method;
  });

  this.scope["super"] = sup;

  return this.inheriting(node.request, context).then(function (value) {
    delete this.scope.object;
    return value;
  }, function (packet) {
    return this.report(packet, "inherits " + node.request.name(), null, node);
  });
};

// Create a new variable accessor that stores the value it is accessing as a
// property.
Interpreter.prototype.newVar = function (name, value, isPublic) {
  var variable = rt.method(name, 0, function () {
    if (util.owns(variable, "value")) {
      return variable.value;
    }

    return rt.UndefinedValue.raiseForName(rt.string(name));
  });

  if (value !== undefined) {
    variable.value = value;
  }

  variable.isVariable = true;
  variable.isConfidential = !isPublic;
  variable.identifier = name;
  variable.modulePath = this.modulePath;

  return variable;
};

// Create a new type accessor that stores the number of generics as a property.
Interpreter.prototype.newType = function (name, generics) {
  var type, value;

  value = rt.proxy(name);

  type = rt.method(name, [ [ generics, 0 ] ], function () {
    return rt.withGenerics
      .apply(null, [ name, value ].concat(util.slice(arguments)));
  });

  type.value = value;
  type.isStatic = true;
  type.modulePath = this.modulePath;

  return type;
};


// scoped(self : Object, action : () -> T) -> Task<T>
//   Push a new layer and a new self context on to the scope stack, execute an
//   action, and then pop it off.
//
// scoped(action : () -> T) -> Task<T>
//   Push a new layer on to the scope stack, execute an action, and then pop it
//   off.
Interpreter.prototype.scoped = function (context, action) {
  if (typeof context === "function") {
    action = context;
    context = undefined;
  }

  this.push(context);
  return this.task(action).then(function (value) {
    this.pop();
    return value;
  }, function (reason) {
    this.pop();
    throw reason;
  });
};

Interpreter.prototype.each = function () {
  return Task.each.apply(Task, [ this ].concat(util.slice(arguments)));
};

Interpreter.prototype.self = function () {
  if (util.owns(this.scope, "self")) {
    return this.scope.self;
  }

  return null;
};

Interpreter.prototype.put = function (pretty, method, node) {
  var context, existing, name, sub, top;

  name = util.uglify(pretty);
  top = this.scope;

  // Because method creation happens bottom upwards, if an invalid override
  // occurs it can't be detected until the super method is evaluated. By saving
  // the node with the method, the lower, erroneous method can be reported
  // rather than the non-erroneous super method.
  method.node = node;

  return this.task(function () {
    if (util.owns(top, name)) {
      existing = top[name] && top[name].identifier || pretty;

      return rt.Redefinition.raiseForName(rt.string(existing));
    }

    context = this.self();
    if (context === null) {
      top[name] = method;
    } else if (context[name] !== undefined) {
      if (util.owns(context, name)) {
        sub = context[name];
      } else {
        sub = method;
        method = context[name];
        context[name] = sub;
      }

      if (method.isStatic) {
        node = sub.node;
        return rt.InvalidMethod.raiseStaticOverrideForName(rt.string(pretty));
      }

      if (sub.isVariable) {
        node = sub.node;
        return rt.InvalidMethod
          .raiseOverridingVariableForName(rt.string(pretty));
      }

      while (util.owns(sub, "super")) {
        sub = sub["super"];
      }

      if (!rt.isSubMethod(sub.parts, method.parts)) {
        node = sub.node;
        return rt.InvalidMethod
          .raiseMismatchedParametersForName(rt.string(pretty));
      }

      sub["super"] = method;
    } else {
      context[name] = method;
    }

    top[name] = method;
  }).bind(this).then(null, function (packet) {
    return this.reportNode(packet, node);
  });
};

Interpreter.prototype.push = function (context) {
  var frame = {};

  if (context !== undefined) {
    frame.self = context;
  }

  frame.outer = this.scope;
  this.scope = frame;
};

Interpreter.prototype.pop = function () {
  this.scope = this.scope.outer;
};

// Search for a value with the given name on self or in scope.
Interpreter.prototype.search = function (name) {
  var context, frame;

  function pair(method) {
    return [ context, method ];
  }

  for (frame = this.scope; frame !== null; frame = frame.outer) {
    if (util.owns(frame, "self")) {
      context = frame.self;

      if (context[name] !== undefined) {
        return rt.lookup(context, name, true).bind(this).then(pair);
      }
    }

    if (util.owns(frame, name)) {
      return this.resolve([ null, frame[name] ]);
    }
  }

  return this.resolve(null);
};

// Find definitions stored in scope without searching through self. Takes an
// optional boolean where false indicates that the search should stop once
// it encounters a self value, and true indicates that the search should begin
// after the first self value.
Interpreter.prototype.searchScope = function (name, passSelf) {
  var frame;

  for (frame = this.scope; frame !== null; frame = frame.outer) {
    if (!passSelf && util.owns(frame, name)) {
      return frame[name];
    }

    if (util.owns(frame, "self")) {
      if (frame.outer === null && frame.self[name] !== undefined) {
        return frame.self[name];
      }

      if (passSelf === false) {
        return null;
      }

      if (passSelf === true) {
        passSelf = undefined;
      }
    }
  }

  return null;
};

// Resolve to a task with this Interperter as the context.
Interpreter.prototype.resolve = function (value) {
  return Task.resolve(this, value);
};

// Safely wrap an action as a task.
Interpreter.prototype.task = function (action) {
  return this.resolve(null).then(function () {
    return action.call(this);
  });
};

Interpreter.prototype.raise = function (message) {
  return rt.InternalError.raise(rt.string(message)).bind(this);
};

Interpreter.prototype.report = function (packet, name, object, node) {
  return this.task(function () {
    return rt.handleInternalError(packet);
  }).then(null, function (internalError) {
    internalError.object.stackTrace.push(rt.trace(name, object, {
      "module": this.modulePath || null,
      "line": node.location.line,
      "column": node.location.column
    }));

    throw internalError;
  });
};

Interpreter.prototype.reportNode = function (packet, node) {
  var type;

  if (node.constructor === ast.Def) {
    type = "def " + node.name.value;
  } else if (node.constructor === ast.Var) {
    type = "var " + node.name.value;
  } else if (node.constructor === ast.Method) {
    type = "method " + node.signature.name();
  } else if (node.constructor === ast.Class) {
    type = "class " + node.name.value;
  } else if (node.constructor === ast.TypeDeclaration) {
    type = "type " + node.name.value;
  } else if (node.constructor === ast.Import) {
    type = 'import "..." as ' + node.identifier.value;
  } else {
    type = node.toString();
  }

  return this.report(packet, type, null, node);
};

exports.Interpreter = Interpreter;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ast":1,"./runtime":10,"./task":19,"./util":21,"path":26}],5:[function(require,module,exports){
(function (process){
// Handles locating and loading imported Grace modules in Node.js. Browsers
// should override the loading mechanism when using the external interpreter
// API.

"use strict";

var Task, fs, path, readFile, rt;


path = require("path");

Task = require("./task");
rt = require("./runtime");

function loadGrace(interpreter, name) {
  readFile = readFile || Task.taskify(fs.readFile);

  return readFile(name + ".grace").then(function (code) {
    code = code.toString();

    // Ignore hashbang.
    if (code[0] === "#" && code[1] === "!") {
      while (code[0] === "#") {
        code = code.substring(code.indexOf("\n") + 1 || code.length);
      }
    }

    return Task.taskify(interpreter.module).call(interpreter, name, code);
  });
}

exports.loadGrace = loadGrace;

function loadJavaScript(name) {
  try {
    return Task.resolve(require(name));
  } catch (reason) {
    return Task.reject(reason);
  }
}

exports.defaultLoader = function (interpreter, name, callback) {
  name = path.join(path.dirname(name), path.basename(name, ".grace"));

  loadGrace(interpreter, name).then(null, function (graceError) {
    var local;

    if (rt.isGraceExceptionPacket(graceError)) {
      throw graceError;
    }

    local = path.join(process.cwd(), name);

    return loadJavaScript(local).then(null, function (jsError) {
      if (jsError.code !== "MODULE_NOT_FOUND") {
        return rt.InternalError.raiseFromPrimitiveError(jsError);
      }

      return loadJavaScript(name);
    }).then(null, function (jsError) {
      if (jsError.code !== "MODULE_NOT_FOUND") {
        return rt.InternalError.raiseFromPrimitiveError(jsError);
      }

      return rt.UnresolvedModule
        .raiseForPath(rt.string(name)).then(null, callback);
    });
  }).callback(callback);
};

}).call(this,require('_process'))
},{"./runtime":10,"./task":19,"_process":27,"path":26}],6:[function(require,module,exports){
// Provides the 'parse' function, which transforms a list of lexed tokens into a
// list of Grace AST nodes.

"use strict";

var Task, ast, error, lexer, lookahead, tokens, util;

Task = require("./task");
ast = require("./ast");
error = require("./parser/error");
lexer = require("./parser/lexer");
tokens = require("./parser/tokens");
util = require("./util");

function isMathOperator(op) {
  return op === "^" || op === "/" || op === "*" || op === "+" || op === "-";
}

function precedence(lhs, rhs) {
  var left, right;

  left = lhs.value;
  right = rhs.value;

  if (left === right) {
    return true;
  }

  if (!isMathOperator(left) || !isMathOperator(right)) {
    error.raise(lhs, "Mismatched operators " + left + " and " + right);
  }

  return left === "^" || (left === "/" || left === "*") && right !== "^" ||
    (left === "+" || left === "-") && (right === "+" || right === "-");
}

function slice(ctx, from, to) {
  return Array.prototype.slice.call(ctx, from, to);
}

lookahead = {

  "keyword": function (value, parser) {
    return this.value(tokens.Keyword, value, parser);
  },

  "symbol": function (value, parser) {
    return this.value(tokens.Symbol, value, parser);
  },

  "punctuation": function (value, parser) {
    return this.value(tokens.Punctuation, value, parser);
  },

  "newline": function (parser) {
    parser.test = function () {
      var token = this.peek("newline");
      return token &&
        (token.constructor === tokens.Newline || token.value === ";");
    };

    return parser;
  },

  "identifier": function (parser) {
    return this.type(tokens.Identifier, parser);
  },

  "operator": function (parser) {
    return this.type(tokens.Symbol, parser);
  },

  "string": function (parser) {
    return this.type(tokens.StringLiteral, parser);
  },

  "number": function (parser) {
    return this.type(tokens.NumberLiteral, parser);
  },

  "value": function (type, value, parser) {
    parser.test = function () {
      var token = this.peek(type);

      return token.constructor === type &&
        (typeof value === "string" && token.value === value ||
          typeof value === "function" && value(token.value));
    };

    return parser;
  },

  "type": function (type, parser) {
    parser.test = function (value) {
      var token = this.peek(type);

      return token.constructor === type &&
        (typeof value !== "string" || token.value === value);
    };

    return parser;
  },

  "name": function (parser) {
    parser.test = function (value) {
      var token, type;

      token = this.peek();
      type = token.constructor;

      return (type === tokens.Identifier || type === tokens.Symbol) &&
        (typeof value !== "string" || token.value === value);
    };

    return parser;
  },

  "parsers": function (name) {
    var after, i, l, parser, parsers;

    function run(test, failure) {
      return function () {
        var pName;

        function then(result) {
          return after ? after.call(this, result) : result;
        }

        for (i = 0; i < l; i += 1) {
          pName = parsers[i];
          if (this.test(pName)) {
            if (test) {
              return test;
            }

            return this.one(pName).then(then);
          }
        }

        return failure.call(this);
      };
    }

    l = arguments.length;

    if (typeof arguments[l - 1] === "function") {
      after = arguments[l - 1];
      l -= 1;
    }

    parsers = Array.prototype.slice.call(arguments, 1, l);
    l = parsers.length;

    parser = run(false, function () {
      this.raise(name);
    });

    parser.test = run(true, function () {
      return false;
    });

    return parser;
  }

};

function Parser(lex) {
  this.lexer = lex;
  this.indent = 0;
  this.token = null;
}

util.inherits(Parser, Task.Async);

Parser.prototype.module = function () {
  return this.lone("dialect").then(function (dialect) {
    return this.any("import").then(function (imports) {
      if (dialect !== null) {
        imports.unshift(dialect);
      }

      return imports;
    });
  }).then(function (head) {
    return this.objectBody().then(function (body) {
      return head.concat(body);
    });
  });
};

Parser.prototype.newline = lookahead.newline(function () {
  var indent, token;

  token = this.peek("newline");

  // A close brace counts as an implicit newline and may change indentation,
  // otherwise indentation must match.
  if (token.value !== "}") {
    if (token.value === ";") {
      this.poll();
    } else if (token.constructor !== tokens.EndOfInput) {
      token = this.poll();

      if (token.constructor !== tokens.Newline) {
        error.raise(token, "Unexpected appearance of " + token);
      }

      indent = token.indent;

      if (indent !== this.indent && this.peek().value !== "}") {
        error.raise(token, "Indent must match previous line");
      }
    }
  }
});

Parser.prototype.def = lookahead.keyword("def", function () {
  var ident, token;

  token = this.keyword("def");
  ident = this.identifier();

  this.inDef = true;

  return this.on("symbol", ":", function () {
    return this.expression();
  }).then(function (pattern) {
    return this.lone("annotations").then(function (annotations) {
      this.inDef = false;

      if (this.test("symbol", ":=")) {
        error.raise(this.poll(), "A constant declaration must use " +
          new tokens.Symbol("=") + " instead of " + new tokens.Symbol(":="));
      }

      if (!this.test("symbol", "=")) {
        error.raise(this.poll(), "A constant declaration must have " +
          new tokens.Symbol("=") + " and a value");
      }

      this.symbol("=");

      return this.expression().then(function (value) {
        this.newline();

        return new ast.Def(ident, pattern, annotations || [], value, token);
      });
    });
  });
});

Parser.prototype["var"] = lookahead.keyword("var", function () {
  var ident, token;

  token = this.keyword("var");
  ident = this.identifier();

  return this.on("symbol", ":", function () {
    return this.strict(this.expression);
  }).then(function (pattern) {
    return this.lone("annotations", true).then(function (annotations) {
      if (this.test("symbol", "=")) {
        error.raise(this.poll(), "A variable declaration must use " +
          new tokens.Symbol(":=") + " instead of " + new tokens.Symbol("="));
      }

      return this.on("symbol", ":=", function () {
        return this.expression();
      }).then(function (value) {
        this.newline();

        return new ast.Var(ident, pattern, annotations || [], value, token);
      });
    });
  });
});

Parser.prototype.declOrLiteral = lookahead.keyword("type", function () {
  return this.attempt(function () {
    var keyword = this.keyword("type");

    if (this.test("punctuation", "{")) {
      // Whoops, we thought this was a declaration but it's actually a literal.
      // Push the keyword back and reparse as an expression line.
      error.raise("Attempt to parse type literal as type declaration");
    }

    return keyword;
  }).then(function (token) {
    var name;

    if (token === null) {
      return this.expressionLine();
    }

    name = this.identifier();

    this.inDef = true;

    return this.on("symbol", "<", function () {
      return this.commas("identifier").then(function (generics) {
        this.symbol(">");
        return generics;
      });
    }).then(function (generics) {
      return this.lone("annotations").then(function (annotations) {
        this.inDef = false;

        this.symbol("=");

        return this.lone("typeBraces").then(function (type) {
          return type || this.expression();
        }).then(function (value) {
          this.newline();

          return new ast.TypeDeclaration(name,
            generics || [], annotations || [], value, token);
        });
      });
    });
  });
});

Parser.prototype.type = lookahead.keyword("type", function () {
  this.keyword("type");
  return this.typeBraces();
});

Parser.prototype.typeBraces = lookahead.punctuation("{", function () {
  return this.braces(function (token) {
    return this.any("typeBody").then(function (body) {
      return new ast.Type(body, token);
    });
  });
});

Parser.prototype.typeBody = lookahead.parsers("signature", "signature",
  function (signature) {
    this.newline();
    return signature;
  });

Parser.prototype.object = lookahead.keyword("object", function () {
  var token = this.keyword("object");

  return this.lone("annotations", true).then(function (annotations) {
    return this.braces(function () {
      return this.objectBody().then(function (body) {
        return new ast.ObjectConstructor(annotations || [], body, token);
      });
    });
  });
});

Parser.prototype["class"] = lookahead.keyword("class", function () {
  var name, token;

  token = this.keyword("class");
  name = this.identifier();
  this.punctuation(".");

  return this.methodRest("objectBody", function (signature, annotations, body) {
    return new ast.Class(name, signature, annotations, body, token);
  });
});

Parser.prototype.method = lookahead.keyword("method", function () {
  var token = this.keyword("method");

  return this.methodRest("methodBody", function (signature, annotations, body) {
    return new ast.Method(signature, annotations, body, token);
  });
});

Parser.prototype.constructor = lookahead.keyword("constructor", function () {
  var token = this.keyword("constructor");

  return this.methodRest("objectBody", function (signature, annotations, body) {
    return new ast.Method(signature, annotations,
      [ new ast.ObjectConstructor([], body, token) ], token);
  });
});

Parser.prototype.methodRest = lookahead.name(function (parser, make) {
  return this.signature().then(function (signature) {
    return this.lone("annotations").then(function (annotations) {
      annotations = annotations || [];

      return this.braces(function () {
        return this.one(parser).then(function (result) {
          return make.call(this, signature, annotations, result);
        });
      });
    });
  });
});

Parser.prototype.signature = lookahead.name(function () {
  return this.signaturePartFirst().then(function (first) {
    return this.task(function () {
      if (first.parameters.length === 0 || first.name.isOperator) {
        return [ first ];
      }

      return this.any("signaturePartRest").then(function (rest) {
        rest.unshift(first);
        return rest;
      });
    }).then(function (parts) {
      return this.on("symbol", "->", function () {
        return this.strict(this.expression);
      }).then(function (pattern) {
        return new ast.Signature(parts, pattern, first);
      });
    });
  });
});

Parser.prototype.signaturePartFirst = lookahead.name(function () {
  return this.lone("operator").then(function (operator) {
    if (operator === null) {
      return this.identifier();
    }

    return operator;
  }).then(function (name) {
    if (!name.isOperator) {
      if (name.value === "prefix") {
        return this.on("operator", function (operator) {
          name.isOperator = true;
          name.value += operator.value;
        }).then(function () {
          return new ast.SignaturePart(name, [], []);
        });
      }

      if (this.test("symbol", ":=")) {
        this.poll();
        name.isOperator = true;
        name.value += " :=";

        return this.parentheses(this.parameter).then(function (parameter) {
          return new ast.SignaturePart(name, [], [ parameter ]);
        });
      }
    }

    return this.signaturePartPost(name, true);
  });
});

Parser.prototype.signaturePartRest = lookahead.identifier(function () {
  var name = this.identifier();

  return this.signaturePartPost(name, false);
});

Parser.prototype.signaturePartPost = function (name, first) {
  return this.task(function () {
    if (!name.isOperator) {
      return this.on("symbol", "<", function () {
        return this.commas("identifier").then(function (generics) {
          this.symbol(">");
          return generics;
        });
      });
    }
  }).then(function (generics) {
    return this[first ? "lone" : "one"]("parentheses", function () {
      if (name.isOperator) {
        return this.parameter().then(function (parameter) {
          return [ parameter ];
        });
      }

      return this.commas("parameter");
    }).then(function (parameters) {
      return new ast.SignaturePart(name, generics || [], parameters || []);
    });
  });
};

Parser.prototype.parameter =
  lookahead.parsers("parameter", "vararg", "binding");

Parser.prototype.vararg = lookahead.symbol("*", function () {
  var token = this.symbol("*");

  return this.parameterName().then(function (name) {
    return this.parameterType().then(function (type) {
      return new ast.Parameter(name, type, true, token);
    });
  });
});

Parser.prototype.binding =
  lookahead.parsers("parameter", "parameterName", function (name) {
    return this.parameterType().then(function (type) {
      return new ast.Parameter(name, type, false, name);
    });
  });

Parser.prototype.parameterName =
  lookahead.parsers("parameter", "identifier", "underscore");

Parser.prototype.parameterType = function () {
  return this.on("symbol", ":", function () {
    return this.expression();
  });
};

// Require one or more of the given parsings, separated by commas.
Parser.prototype.commas = function (parser) {
  function comma(results) {
    return this.on("punctuation", ",", function () {
      return this.one(parser).then(function (result) {
        results.push(result);
        return comma.call(this, results);
      });
    }).then(function (next) {
      return next || results;
    });
  }

  return this.one(parser).then(function (first) {
    return comma.call(this, [ first ]);
  });
};

Parser.prototype.braces = lookahead.punctuation("{", function (f) {
  var state = this.indent;

  return this.wrapped("{", "}", function (token) {
    this.postBraceIndent();
    return this.resolve(f.call(this, token));
  }).then(function (result) {
    this.indent = state;
    return result;
  });
});

Parser.prototype.postBraceIndent = function () {
  var indent, next;

  next = this.peek("newline");

  if (next.constructor === tokens.Newline) {
    next = this.poll();
    indent = next.indent;

    if (indent < this.indent && this.peek().value !== "}") {
      error.raise(next, "Invalid indent following opening brace");
    }

    this.indent = indent;
  }
};

Parser.prototype.parentheses = lookahead.punctuation("(", function (f) {
  return this.wrapped("(", ")", function () {
    return this.resolve((f || this.expression).call(this))
      .then(function (expr) {
        return this.lone("newline").then(function () {
          return expr;
        });
      });
  });
});

Parser.prototype.wrapped = function (o, c, f) {
  return this.resolve(f.call(this, this.punctuation(o)))
    .then(function (result) {
      var token;

      if (!this.test("punctuation", c)) {
        token = this.poll();

        error.raise(token, "Unexpected appearance of " + token);
      }

      this.punctuation(c);

      return result;
    });
};

Parser.prototype.dialect = lookahead.keyword("dialect", function () {
  var token = this.keyword("dialect");

  return this.string().then(function (path) {
    this.newline();

    return new ast.Dialect(path, token);
  });
});

Parser.prototype["import"] = lookahead.keyword("import", function () {
  var token = this.keyword("import");

  return this.string().then(function (path) {
    var ident;

    this.contextualKeyword("as");
    ident = this.identifier();
    this.newline();

    return new ast.Import(path, ident, token);
  });
});

Parser.prototype.inherits = lookahead.keyword("inherits", function () {
  var token = this.keyword("inherits");

  return this.expression().then(function (request) {
    if (request.constructor !== ast.UnqualifiedRequest &&
        request.constructor !== ast.QualifiedRequest &&
        request.constructor !== ast.BooleanLiteral) {
      this.raise("request", request);
    }

    this.newline();

    return new ast.Inherits(request, token);
  });
});

Parser.prototype["return"] = lookahead.keyword("return", function () {
  var token = this.keyword("return");

  return this.lone("expression").then(function (expression) {
    this.newline();

    return new ast.Return(expression, token);
  });
});

Parser.prototype.statement = lookahead.parsers("statement",
  "def", "var", "declOrLiteral", "return", "expressionLine", "newline");

Parser.prototype.expression = lookahead.parsers("expression",
  "preBinaryOperator", function (expression) {
    var token;

    function buildBinary(lhs, op, rhs) {
      return new ast.QualifiedRequest(lhs,
        [ new ast.RequestPart(op, [], [ rhs ]) ]);
    }

    // Parse trailing binary operator requests.
    function operators(lhs, lop, rhs) {
      return this.on("operator", function (rop) {
        return this.preBinaryOperator().then(function (pre) {
          if (precedence(lop, rop)) {
            return operators.call(this, buildBinary(lhs, lop, rhs), rop, pre);
          }

          return operators.call(this, lhs, lop, buildBinary(rhs, rop, pre));
        });
      }).then(function (op) {
        return op || buildBinary(lhs, lop, rhs);
      });
    }

    // Avoid consuming generic closing parameters.
    if (this.generics && this.peek().value[0] === ">") {
      return expression;
    }

    if (!this.inDef && this.test("symbol", "=")) {
      token = this.poll();

      error.raise(token, "Assignment must use " +
        new tokens.Symbol(":=") + ", not " + token);
    }

    return this.on("operator", function (op) {
      return this.preBinaryOperator().then(function (pre) {
        return operators.call(this, expression, op, pre);
      });
    }).then(function (op) {
      return op || expression;
    });
  });

// Parse an expression up to a binary operator.
Parser.prototype.preBinaryOperator = lookahead.parsers("expression",
  "object", "type", "unqualifiedRequest", "literal", "bool", "outer",
  "self", "super", "parentheses", "prefixOperator", function (expression) {
    // Parse trailing dot requests.
    function requests(receiver) {
      return this.on("dotRequest", function (signature) {
        return requests.call(this,
          new ast.QualifiedRequest(receiver, signature));
      }).then(function (request) {
        return request || receiver;
      });
    }

    return requests.call(this, expression);
  });

// Expressions may appear alone on a single line, in which case they become a
// statement.
Parser.prototype.expressionLine = lookahead.parsers("expression line",
  "expression", function (expression) {
    this.newline();
    return expression;
  });

Parser.prototype.bool = lookahead.parsers("boolean", "true", "false");

Parser.prototype["true"] = lookahead.keyword("true", function () {
  return new ast.BooleanLiteral(true, this.keyword("true"));
});

Parser.prototype["false"] = lookahead.keyword("false", function () {
  return new ast.BooleanLiteral(false, this.keyword("false"));
});

Parser.prototype.outer = lookahead.keyword("outer", function () {
  var keyword = this.keyword("outer");

  return this.request().then(function (request) {
    return new ast.QualifiedRequest(new ast.Outer(keyword), request);
  });
});

Parser.prototype.prefixOperator = lookahead.operator(function () {
  var prefix = this.operator();

  prefix.value = "prefix" + prefix.value;

  return this.preBinaryOperator().then(function (receiver) {
    return new ast.QualifiedRequest(receiver,
      [ new ast.RequestPart(prefix, [], []) ]);
  });
});

// Parse a request with no receiver.
Parser.prototype.unqualifiedRequest = lookahead.identifier(function () {
  return this.requestSignature().then(function (signature) {
    return new ast.UnqualifiedRequest(signature);
  });
});

// Parse the signature part of a request, resulting in a list of signature
// parts.
Parser.prototype.request = lookahead.parsers("request signature",
  "dotRequest", "binaryRequestSignature");

// Parse a dot-requested signature.
Parser.prototype.dotRequest = lookahead.punctuation(".", function () {
  this.punctuation(".");
  return this.requestSignature();
});

// Parse a request signature whose parts are identifiers.
Parser.prototype.requestSignature = lookahead.identifier(function () {
  return this.requestPart(false).then(function (first) {
    if (first["arguments"].length === 0) {
      return [ first ];
    }

    return this.any("requestPart", true).then(function (parts) {
      parts.unshift(first);
      return parts;
    });
  });
});

Parser.prototype.requestPart = lookahead.identifier(function (required) {
  var name = this.identifier();

  return this.task(function () {
    var state;

    if (this.test("symbol", "<") && !this.peek().spaced) {
      state = this.generics;

      return this.attempt(function () {
        this.symbol("<");
        this.generics = true;

        return this.commas("expression").then(function (types) {
          var after, next;

          next = this.peek();
          if (next.value[0] === ">" && next.value.length > 1) {
            // The lexer got confused and attached the closing chevron to some
            // following symbols. Rip out the chevron and leave the symbols.
            next.value = next.value.substring(1);
          } else {
            this.symbol(">");
          }

          after = this.peek();

          if (after.constructor === tokens.Identifier ||
              after.constructor === tokens.Keyword && after.value !== "is" &&
                after.value !== "true" && after.value !== "false") {
            error.raise(after, "Invalid token following generic parameters");
          }

          return types;
        });
      }).then(function (generics) {
        this.generics = state;
        return generics;
      });
    }
  }).then(function (generics) {
    return this.on(this.isStrict ? "strictLiteral" : "literal", function (arg) {
      if (arg.constructor !== ast.Block && this.test("punctuation", ".")) {
        error.raise(this.punctuation("."),
          "Method requests on literal parameters must be wrapped");
      }

      return [ arg ];
    }).then(function (args) {
      if (!required && !this.isStrict && args === null) {
        return this.on("symbol", ":=", function () {
          name.isOperator = true;
          name.value += " :=";

          return this.expression().then(function (expression) {
            return [ expression ];
          });
        });
      }

      return args;
    }).then(function (args) {
      if (args === null) {
        return this[required ? "one" : "lone"]("parentheses", function () {
          return this.commas("expression");
        });
      }

      return args;
    }).then(function (args) {
      return new ast.RequestPart(name, generics || [], args || []);
    });
  });
});

// Parse the signature of a binary operator request.
Parser.prototype.binaryRequestSignature = lookahead.operator(function () {
  var operator = this.operator();

  return this.expression().then(function (rhs) {
    return [ new ast.RequestPart(operator, [], [ rhs ]) ];
  });
});

Parser.prototype.self = lookahead.keyword("self", function () {
  return new ast.Self(this.keyword("self"));
});

Parser.prototype["super"] = lookahead.keyword("super", function () {
  var keyword = this.keyword("super");

  return this.request().then(function (request) {
    return new ast.QualifiedRequest(new ast.Super(keyword), request);
  });
});

Parser.prototype.block = lookahead.punctuation("{", function () {
  return this.braces(function (token) {
    return this.attempt(function () {
      return this.task(function () {
        if (!this.test("identifier") && !this.test("punctuation", "_")) {
          return this.expression().then(function (params) {
            return [
              new ast.Parameter(new ast.Identifier("_", false, params),
                params, false, params)
            ];
          });
        }

        return this.commas("parameter");
      }).then(function (params) {
        this.symbol("->");
        this.postBraceIndent();

        return params;
      });
    }).then(function (params) {
      return this.any("statement").then(function (body) {
        return new ast.Block(params || [], body, token);
      });
    });
  });
});

Parser.prototype.annotations = lookahead.keyword("is", function (isStrict) {
  this.keyword("is");

  return this.strict(function () {
    return this.commas("expression");
  }, isStrict);
});

Parser.prototype.literal =
  lookahead.parsers("literal", "strictLiteral", "block");

Parser.prototype.strictLiteral =
  lookahead.parsers("literal", "bool", "string", "number");

Parser.prototype.string = lookahead.string(function () {
  var concat, string, token;

  token = this.expect(tokens.StringLiteral);
  string = new ast.StringLiteral(token.value, token);

  if (token.interpolation) {
    concat = new ast.Identifier("++", true, token);

    return this.expression().then(function (expression) {
      var interpolation = new ast.QualifiedRequest(string,
        [ new ast.RequestPart(concat, [], [ expression ]) ]);

      // The newline allows the string to return to its previous indentation.
      this.lone("newline");
      this.punctuation("}");
      this.token = this.lexer.nextToken(true);

      return this.string().then(function (rest) {
        return new ast.QualifiedRequest(interpolation,
          [ new ast.RequestPart(concat, [], [ rest ]) ]);
      });
    });
  }

  return this.resolve(string);
});

Parser.prototype.number = lookahead.number(function () {
  var base, token, value, x;

  token = this.expect(tokens.NumberLiteral);
  value = token.value;

  x = value.match(/[xX]/);

  if (x !== null) {
    base = Number(value.substring(0, x.index));

    if (base > 1 && base < 37) {
      value = parseInt(value.substring(x.index + 1), base);
    }
  }

  return new ast.NumberLiteral(value, token);
});

Parser.prototype.objectBody = function () {
  return this.lone("inherits").then(function (inherits) {
    return this.any("statementOrMethod").then(function (body) {
      if (inherits !== null) {
        body.unshift(inherits);
      }

      return body;
    });
  });
};

Parser.prototype.methodBody = function () {
  return this.any("statement");
};

Parser.prototype.statementOrMethod =
  lookahead.parsers("statement", "method", "class", "constructor", "statement");

// Expect and consume a certain keyword.
Parser.prototype.keyword = lookahead.type(tokens.Keyword, function (key) {
  var token = this.expect(tokens.Keyword, key);

  if (token.value !== key) {
    this.raise("keyword " + key, token);
  }

  return token;
});

// Expect and parse the given identifier as a keyword.
Parser.prototype.contextualKeyword = lookahead.type(tokens.Identifier,
  function (key) {
    var token = this.expect(tokens.Identifier, key);

    if (token.value !== key) {
      this.raise("keyword " + key, token);
    }

    return token;
  });

// Expect and consume a certain symbol.
Parser.prototype.symbol = lookahead.type(tokens.Symbol, function (sym) {
  var token = this.expect(tokens.Symbol, sym);

  if (token.value !== sym) {
    this.raise("symbol " + sym, token);
  }

  return token;
});

// Expect and consume a certain piece of punctuation.
Parser.prototype.punctuation = lookahead.type(tokens.Punctuation,
  function (sym) {
    var token = this.expect(tokens.Punctuation, sym);

    if (token.value !== sym) {
      this.raise(new tokens.Punctuation(sym, null), token);
    }

    return token;
  });

// Expect and parse an operator.
Parser.prototype.operator = lookahead.value(tokens.Symbol, function (symbol) {
  return symbol !== "=" && symbol !== "->" && symbol !== ":=" && symbol !== ":";
}, function () {
  var token = this.expect(tokens.Symbol, "operator");

  return new ast.Identifier(token.value, true, token);
});

// Expect and parse an identifier.
Parser.prototype.identifier = lookahead.identifier(function () {
  var token = this.expect(tokens.Identifier);

  return new ast.Identifier(token.value, false, token);
});

Parser.prototype.underscore = lookahead.punctuation("_", function () {
  var token = this.punctuation("_");

  return new ast.Identifier("_", false, token);
});

// Expect a certain type of token, throwing away newlines in between. May be
// provided with a second type which will be used instead of the first for
// error reporting.
Parser.prototype.expect = function (Type, etype) {
  var token;

  if (Type !== tokens.Newline) {
    this.trim();
  }

  token = this.poll();

  if (token === null || token.constructor !== Type) {
    if (typeof etype === "string") {
      etype = new Type(etype, token.location);
    }

    this.raise(etype || Type, token);
  }

  return token;
};

// Trim out leading newlines from the token queue whose indent is greater than
// the current indent.
Parser.prototype.trim = function () {
  var token = this.peek("newline");

  while (token.constructor === tokens.Newline && token.indent > this.indent) {
    this.poll();
    token = this.peek("newline");
  }
};

// Poll the token queue, removing and returning the first element.
Parser.prototype.poll = function () {
  var token = this.token;

  if (token !== null) {
    if (token.constructor !== tokens.EndOfInput) {
      this.token = null;
    }
  } else {
    token = this.lexer.nextToken();
    this.token = token;
  }

  return token;
};

// Peek at the token queue, returning the first element, skipping over
// newlines whose indent is greater than the current indent. Optionally takes
// the type of the token to search for, to avoid skipping over newlines when
// newlines are being searched for.
Parser.prototype.peek = function (type) {
  var lex, token;

  token = this.token;

  if (token !== null) {
    return this.token;
  }

  lex = this.lexer;
  token = lex.nextToken();

  if (type !== "newline") {
    while (token.constructor === tokens.Newline && token.indent > this.indent) {
      token = lex.nextToken();
    }
  }

  this.token = token;
  return token;
};

Parser.prototype.raise = function (type, token) {
  if (token === undefined) {
    token = this.peek();
  }

  error.raise(token, "Expected " + type + ", but found " + token);
};

Parser.prototype.test = function (parser) {
  return this[parser].test.apply(this, slice(arguments, 1));
};

Parser.prototype.one = function (parser) {
  return this.resolve(this[parser].apply(this, slice(arguments, 1)));
};

Parser.prototype.lone = function () {
  return this.test.apply(this, arguments) ?
      this.one.apply(this, arguments) : this.resolve(null);
};

Parser.prototype.any = function () {
  var args = arguments;

  function any(results) {
    if (this.test.apply(this, args)) {
      return this.one.apply(this, args).then(function (result) {
        if (typeof result === "object") {
          results.push(result);
        }

        return any.call(this, results);
      });
    }

    return this.resolve(results);
  }

  return any.call(this, []);
};

Parser.prototype.many = function () {
  return this.one.apply(this, arguments).then(function (result) {
    return this.any.apply(this, arguments).then(function (results) {
      results.unshift(result);
      return results;
    });
  });
};

Parser.prototype.on = function () {
  var args, l;

  l = arguments.length - 1;
  args = slice(arguments, 0, l);

  if (this.test.apply(this, args)) {
    return this.one.apply(this, args).then(arguments[l]);
  }

  return this.resolve(null);
};

Parser.prototype.attempt = function (f) {
  var lex, token;

  lex = this.lexer;
  token = this.token;

  this.lexer = lex.clone();

  return this.task(function () {
    return f.call(this);
  }).then(null, function () {
    this.lexer = lex;
    this.token = token;
    return null;
  });
};

Parser.prototype.strict = function (func, isStrict) {
  var state = this.isStrict;

  this.isStrict = isStrict === false ? false : true;

  return this.resolve(func.call(this)).then(function (result) {
    this.isStrict = state;

    return result;
  });
};

// Parse a token stream.
function parse(code) {
  var parser, token;

  try {
    parser = new Parser(new lexer.Lexer(code));

    while (parser.peek().constructor === tokens.Newline) {
      parser.poll();
    }

    return parser.module().then(function (module) {
      do {
        token = parser.poll();
      } while (token.constructor !== tokens.EndOfInput &&
        token.constructor === tokens.Newline);

      if (token.constructor !== tokens.EndOfInput) {
        error.raise(token, "Unexpected appearance of " + token);
      }

      return module;
    }).bind(null);
  } catch (reason) {
    return Task.reject(reason);
  }
}

exports.parse = parse;
exports.ParseError = error.ParseError;
exports.isSymbol = lexer.isSymbol;

},{"./ast":1,"./parser/error":7,"./parser/lexer":8,"./parser/tokens":9,"./task":19,"./util":21}],7:[function(require,module,exports){
// The ParseError definition and the 'raise' helper, which are used by both the
// lexer and the parser.

"use strict";

var util = require("../util");

function ParseError(token, message) {
  this.message = message;
  this.line = token.location.line;
  this.column = token.location.column;
}

util.inherits(ParseError, Error);

ParseError.prototype.toString = function () {
  return "ParseError: " + this.message;
};

function raise(token, message) {
  throw new ParseError(token, message);
}

exports.ParseError = ParseError;
exports.raise = raise;

},{"../util":21}],8:[function(require,module,exports){
// Provides the 'lex' function, which transforms a string into a list of tokens,
// preparing it for parsing.

"use strict";

var error, puncSymbols, tokens, unicode, util;

error = require("./error");
tokens = require("./tokens");
unicode = require("../unicode");
util = require("../util");

puncSymbols = [ "-", "&", "|", ":", "%", "^", "@", "?", "*", "/", "+", "!" ];

function isSymbol(c) {
  return unicode.isSymbol(c) || util.contains(puncSymbols, c);
}

function Lexer(text) {
  this.text = text;
  this.index = 0;
  this.length = text.length;

  util.makeCloneable(this, "index");
}

Lexer.prototype.raise = function (message) {
  error.raise({
    "location": {
      "line": this.line(),
      "column": this.column()
    }
  }, message);
};

Lexer.prototype.newToken = function (Constructor) {
  var args = util.slice(arguments, 1);

  args.push({
    "line": this.line(),
    "column": this.column()
  });

  return util.newApply(Constructor, args);
};

Lexer.prototype.line = function () {
  var match = this.text.substring(0, this.index).match(/\n/g);

  if (match === null) {
    return 1;
  }

  return match.length + 1;
};

Lexer.prototype.column = function () {
  var text = this.text.substring(0, this.index);

  return text.substring(text.lastIndexOf("\n") + 1).length + 1;
};

Lexer.prototype.nextToken = function (interpolating) {
  var c, dot, e, escaped, i, l, self, spaced, text, token, value, x;

  function raise(message) {
    self.index = i;
    self.raise(message);
  }

  function update(result) {
    self.index = i;
    return (result || token).validate(self);
  }

  function increment(result) {
    i += 1;
    return update(result);
  }

  function step() {
    token.value += c;
    i += 1;
    c = text[i];
  }

  // Test if the current character is a newline.
  function testNewline() {
    c = text[i];

    if (c === "\r") {
      if (text[i + 1] !== "\n") {
        raise("Invalid Unicode character «\\r» without corresponding «\\n»");
      }

      // Adjust text accordingly.
      i += 1;
      c = "\r\n";

      return true;
    }

    return c === "\n" || c === "\u2028";
  }

  function countSpaces() {
    var count = 0;

    while (text[i] === " ") {
      count += 1;
      i += 1;
    }

    return count;
  }

  function handleNewline() {
    var old, spaces;

    old = null;

    // Consecutive newlines are irrelevant. Remove them and any intervening
    // whitespace.
    do {
      i += 1;
      spaces = countSpaces();

      // Ignore comments.
      if (text[i] === "/" && text[i + 1] === "/") {
        if (old !== null) {
          spaces = old;
        }

        while (i < l && !testNewline()) {
          i += 1;
        }
      }
    } while (testNewline());

    return update(self.newToken(tokens.Newline, spaces));
  }

  // This is called when a error with a control character is present in a
  // string, but we want to finish lexing the rest of the string so that it can
  // be reported in the resulting error.
  function futureControlError(message, offending) {
    if (token.validate === tokens.StringLiteral.prototype.validate) {
      token.validate = function (lexer) {
        lexer.raise(message + " «" + offending + "» in " + this);
      };
    }
  }

  self = this;
  i = this.index;
  l = this.length;

  text = this.text;
  c = text[i];

  spaced = c === " ";

  if (!interpolating) {
    while (c === " ") {
      i += 1;
      c = text[i];
    }

    this.index = i;
  }

  if (i >= l) {
    return this.newToken(tokens.EndOfInput);
  }

  if (!interpolating && c === "/" && text[i + 1] === "/") {
    i -= 1;
    return handleNewline();
  }

  // Pick which token to create based on the current character.
  if (c === '"' || interpolating) {
    token = this.newToken(tokens.StringLiteral, "");
    escaped = false;
  } else if (unicode.isLetter(c) || c === "…") {
    token = this.newToken(tokens.Identifier, c);
  } else if (unicode.isNumber(c)) {
    dot = false;
    e = false;
    x = false;
    token = this.newToken(tokens.NumberLiteral, c);
  } else if (isSymbol(c) || c === "." && text[i + 1] === ".") {
    token = this.newToken(tokens.Symbol, c, spaced);
  } else {
    if (unicode.isPunctuation(c)) {
      return increment(this.newToken(tokens.Punctuation, c, spaced));
    }

    if (testNewline()) {
      return handleNewline();
    }

    if (c === "\t") {
      raise("Invalid tab character: tabs are banned");
    }

    raise("Unrecognised character «" + util.escape(c) + "»");
  }

  // After an interpolation, the current character is the start of the remaining
  // string, and is not used above. Otherwise the current character has been
  // used above to decide which kind of token to lex and should be skipped.
  if (!interpolating) {
    i += 1;
  }

  while (i < l) {
    c = text[i];

    // Token existing: decide what to do depending on the current token.
    if (token.constructor === tokens.Identifier) {
      // Identifier continuations are letters, numbers, apostrophe, primes, and
      // ellipsis.
      if (unicode.isLetter(c) || unicode.isNumber(c) ||
          c === "'" || c === "′" || c === "″" || c === "‴" || c === "…") {
        token.value += c;
      } else {
        return update();
      }
    } else if (token.constructor === tokens.NumberLiteral) {
      if (!e) {
        if (!dot && !x && /[xX.]/.test(c)) {
          if (c === ".") {
            dot = true;
          } else {
            x = true;
          }

          step();
        } else if (/[eE]/.test(c)) {
          e = true;
          step();

          if (c === "+" || c === "-") {
            step();
          }
        }
      }

      if (c && (unicode.isNumber(c) || x && /[a-zA-Z]/.test(c))) {
        token.value += c;
      } else {
        c = token.value[token.value.length - 1];

        if (c === ".") {
          // The dot is for a method call, not a decimal point. Re-lex it.
          token.value = token.value.substring(0, token.value.length - 1);
          i -= 1;
        }

        return update();
      }
    } else if (token.constructor === tokens.Symbol) {
      value = token.value;
      if (isSymbol(c) || c === "." && value[value.length - 1] === ".") {
        token.value += c;
      } else {
        return update();
      }
    } else if (token.constructor === tokens.StringLiteral) {
      if (c === "\n") {
        raise("Missing close quote for " + token);
      } else if (unicode.isControl(c)) {
        token.value += "\ufffd";
        futureControlError("Invalid control character", util.escape(c));
      } else if (escaped) {
        if (new RegExp('["\\\\{}]').test(c)) {
          token.value += c;
        } else if (c === "n") {
          token.value += "\n";
        } else if (c === "t") {
          token.value += "\t";
        } else if (c === "r") {
          token.value += "\r";
        } else if (c === "b") {
          token.value += "\b";
        } else if (c === "f") {
          token.value += "\f";
        } else if (c === "v") {
          token.value += "\v";
        } else if (c === "0") {
          token.value += "\u0000";
        } else if (c === "u") {
          c = text.substr(i + 1, 4).match(/^[0-9a-fA-F]+/);
          c = c && c[0] || "";

          if (c.length < 4) {
            token.value += "\ufffd";

            futureControlError("Invalid Unicode literal value", "\\u" + c);
          } else {
            token.value += String.fromCharCode("0x" + c);
          }

          i += c.length;
        } else {
          futureControlError("Unrecognised escape character", "\\" + c);
          token.value += "\ufffd";
        }
      } else {
        if (c === '"') {
          // Ignore the close quote.
          token.interpolation = false;
          return increment();
        }

        if (c === "{") {
          // Interpolation time!
          token.interpolation = true;
          return increment();
        }

        if (c !== "\\") {
          token.value += c;
        }
      }

      escaped = !escaped && c === "\\";
    }

    i += 1;
  }

  // The text failed to close a string.
  if (token.constructor === tokens.StringLiteral) {
    raise("Missing close quote for " + token);
  }

  // We should only be able to get here if token is set.
  return update();
};

exports.Lexer = Lexer;
exports.isSymbol = isSymbol;

},{"../unicode":20,"../util":21,"./error":7,"./tokens":9}],9:[function(require,module,exports){
// The various lexer token definitions.

"use strict";

var keywords, unicode, util;

unicode = require("../unicode");
util = require("../util");

keywords = [
  "class", "constructor", "def", "dialect", "false",
  "import", "inherits", "is", "method", "object", "outer",
  "return", "self", "super", "true", "type", "var"
];

function isKeyword(value) {
  return util.contains(keywords, value);
}

// new Token(value : String, location : Location, type : String = undefined)
function Token(value, location, type) {
  this.value = value;
  this.location = location;

  if (type !== undefined) {
    this.type = type;
  }
}

Token.prototype.validate = function (lexer) {
  if (this.value.length === 0) {
    lexer.raise("Empty token of type " + this.type);
  }

  return this;
};

Token.prototype.toString = function () {
  return "the " + this.type + " " + this.value;
};

// new Newline(indent : Number)
function Newline(indent, location) {
  Token.call(this, "\n", location);

  this.indent = indent;
}

util.inherits(Newline, Token);

Newline.prototype.toString = function () {
  return "a new line";
};

Newline.toString = Newline.prototype.toString;

// new Keyword(value : String, location : Location)
function Keyword(value, location) {
  Token.call(this, value, location, "keyword");
}

util.inherits(Keyword, Token);

Keyword.prototype.toString = function () {
  return "the keyword «" + this.value + "»";
};

Keyword.toString = function () {
  return "a keyword";
};

// new Identifier(value : String, location : Location)
function Identifier(value, location) {
  Token.call(this, value, location, "identifier");
}

util.inherits(Identifier, Token);

Identifier.prototype.validate = function (lexer) {
  if (isKeyword(this.value)) {
    return new Keyword(this.value, this.location).validate(lexer);
  }

  return Token.prototype.validate.call(this, lexer);
};

Identifier.prototype.toString = function () {
  return "the identifier «" + this.value + "»";
};

Identifier.toString = function () {
  return "an identifier";
};

// new Symbol(value : String, location : Location)
function Symbol(value, spaced, location) {
  Token.call(this, value, location, "symbol");

  this.spaced = spaced;
}

util.inherits(Symbol, Token);

Symbol.toString = function () {
  return "a symbol";
};

function Punctuation(value, spaced, location) {
  Symbol.call(this, value, spaced, location);
}

util.inherits(Punctuation, Token);

Punctuation.toString = function () {
  return "punctuation";
};

// new NumberLiteral(value : String, location : Location)
function NumberLiteral(value, location) {
  Token.call(this, value, location, "number");
}

util.inherits(NumberLiteral, Token);

NumberLiteral.prototype.validate = function (lexer) {
  var base, i, l, last, value, x;

  value = this.value;

  if (value[0] === "0" &&
      value.length > 1 && unicode.isNumber(value[1])) {
    lexer.raise("Leading zero on " + this);
  }

  x = value.match(/[xX]/);
  base = 10;

  if (x !== null && x.index !== value.length - 1) {
    base = Number(value.substring(0, x.index));

    if (base === 0) {
      base = 16;
    }

    if (base < 2 || base > 36 || isNaN(base)) {
      lexer.raise(base + " is not a valid numerical base");
    }

    for (i = x.index + 1, l = value.length; i < l; i += 1) {
      if (isNaN(parseInt(value[i], base))) {

        lexer.raise("'" + value[i] + "' is not a valid digit in base " + base);
      }
    }
  } else {
    last = value[value.length - 1];

    if (/[eExX\+\-]/.test(last)) {
      lexer.raise("Dangling modifier on " + this);
    }

    if (last === ".") {
      lexer.raise("Dangling decimal point on " + this);
    }
  }

  return Token.prototype.validate.call(this, lexer);
};

NumberLiteral.prototype.toString = function () {
  return "the number literal " + this.value;
};

NumberLiteral.toString = function () {
  return "a number";
};

// new StringLiteral(value : String, location : Location)
function StringLiteral(value, location) {
  Token.call(this, value, location, "string");
}

util.inherits(StringLiteral, Token);

StringLiteral.prototype.validate = function () {
  // Do not validate: an empty string is permissible.
  return this;
};

StringLiteral.prototype.toString = function () {
  return 'the string literal "' + util.escape(this.value) + '"';
};

StringLiteral.toString = function () {
  return "a string";
};

// new EndOfInput(location : Location)
function EndOfInput(location) {
  Token.call(this, "end of input", location, "eoi");
}

util.inherits(EndOfInput, Token);

EndOfInput.prototype.toString = function () {
  return "the end of input";
};

EndOfInput.toString = EndOfInput.prototype.toString;

exports.Token = Token;
exports.Newline = Newline;
exports.Keyword = Keyword;
exports.Identifier = Identifier;
exports.Symbol = Symbol;
exports.Punctuation = Punctuation;
exports.NumberLiteral = NumberLiteral;
exports.StringLiteral = StringLiteral;
exports.EndOfInput = EndOfInput;

},{"../unicode":20,"../util":21}],10:[function(require,module,exports){
// Runtime definitions that are independent of an Interpreter instance.

"use strict";

var Task, defs, util;

Task = require("./task");
util = require("./util");

function trace(name, object, location) {
  return {
    "name": name,
    "object": object,
    "location": location || null
  };
}

// gte(count : Number) -> GTE
//   Represents a minimum number of parameters.
function gte(count) {
  return {
    "minimum": count
  };
}

function part(generics, args) {
  args.generics = generics;
  return args;
}

function handleInternalError(error) {
  if (!defs.isGraceExceptionPacket(error)) {
    return defs.InternalError.raiseFromPrimitiveError(error);
  }

  throw error;
}

// method(name : String,
//     parameters : Count = gte(0), func : Function) -> Function
//   Create a single part method of a certain parameter count.
//
// method(name : String,
//     parts : [Count | (generics : Number, parameters : Count = gte(0))],
//     func : Function) -> Function
//   Create an anypart method where each part has a certain generic count and
//   parameter count.
//
// where Count = Number | GTE
function method(name, partCounts, func) {
  var body, i, isGeneric, isMulti, partsLength, unnormalised;

  if (arguments.length < 3) {
    func = partCounts;
    partCounts = [ gte(0) ];
  }

  if (!util.isArray(partCounts)) {
    partCounts = [ partCounts ];
  }

  partsLength = partCounts.length;
  isMulti = partCounts.length > 1;
  isGeneric = false;

  for (i = 0; i < partsLength; i += 1) {
    unnormalised = partCounts[i];

    if (util.isArray(unnormalised)) {
      if (unnormalised.length === 1) {
        unnormalised[1] = gte(0);
      }
    } else {
      partCounts[i] = [ 0, unnormalised ];
    }

    if (unnormalised[0] > 0) {
      isGeneric = true;
    }
  }

  body = function () {
    var argParts, argsLength, first, self;

    argsLength = arguments.length;
    argParts = util.slice(arguments);
    self = this;

    if (partCounts.length === 1) {
      first = argParts[0];

      if (!(util.isArray(first) && util.owns(first, "generics"))) {
        argsLength = 1;
        argParts = [ argParts ];
      }
    }

    // The next two errors can't be caused by the interpreter without an
    // incorrect method definition in JavaScript.

    if (argsLength < partsLength) {
      throw new TypeError('Not enough parts for method "' + name + '"');
    }

    if (argsLength > partsLength) {
      throw new TypeError('Too many parts for method "' + name + '"');
    }

    return Task.each(partCounts, argParts, function (partCount, argPart) {
      if (typeof partCount[1] === "number" && argPart.length < partCount[1] ||
          argPart.length < partCount[1].minimum) {
        return defs.InvalidRequest
          .raiseNotEnoughArgumentsForMethod(defs.string(name));
      }

      if (typeof partCount[1] === "number" && argPart.length > partCount[1]) {
        return defs.InvalidRequest
          .raiseTooManyArgumentsForMethod(defs.string(name));
      }

      if (util.isArray(argPart.generics) && argPart.generics.length !== 0) {
        if (argPart.generics.length < partCount[0]) {
          return defs.InvalidRequest
            .raiseNotEnoughGenericArgumentsForMethod(defs.string(name));
        }

        if (argPart.generics.length > partCount[0]) {
          return defs.InvalidRequest
            .raiseTooManyGenericArgumentsForMethod(defs.string(name));
        }

        return Task.each(argPart.generics, function (generic) {
          return defs.Pattern.assert(generic);
        }).then(function () {
          return argPart.generics.concat(argPart);
        });
      }

      if (isGeneric) {
        // No generics given in the request. Default to Unknown.
        return util.replicate(partCount[0], defs.Unknown).concat(argPart);
      }

      return argPart;
    }).then(function (args) {
      if (!isMulti) {
        args = args[0];
      }

      return func.apply(self, args);
    }).then(function (value) {
      if (value === null || value === undefined) {
        return defs.InternalError.raise(defs
          .string("Method " + body + " returned an undefined value"));
      }

      return value;
    }, handleInternalError).then(null, function (packet) {
      packet.object.stackTrace.push(trace(name, self));

      throw packet;
    });
  };

  body.isGraceMethod = true;
  body.identifier = name;
  body.isAsynchronous = true;
  body.parts = partCounts;

  body.toString = function () {
    return "«" + name + "»";
  };

  return body;
}

// inheritor(name : String,
//     parameters : Count = gte(0), func : Function) -> Function
//   Create a single part inheritor of a certain parameter count.
//
// inheritor(name : String,
//     parts : [Count | (generics : Number, parameters : Count = gte(0))],
//     func : Function) -> Function
//   Create an anypart inheritor where each part has a certain generic count and
//   parameter count.
//
// where Count = Number | GTE
function inheritor(name, parts, func) {
  return method(name, [ 1 ].concat(parts), function (inheriting) {
    var args = util.slice(arguments, 1);

    if (!util.isArray(parts) || parts.length === 1) {
      args = args[0];
    }

    return func.apply(this, [ inheriting[0] ].concat(args));
  });
}

// constructor(name : String,
//     parameters : Count = gte(0), func : Function) -> Function
//   Create a single part constructor of a certain parameter count.
//
// constructor(name : String,
//     parts : [Count | (generics : Number, parameters : Count = gte(0))],
//     func : Function) -> Function
//   Create an anypart constructor where each part has a certain generic count
//   and parameter count.
//
// where Count = Number | GTE
function constructor(name, parts, func) {
  var body = method(name, parts, function () {
    return func.apply(this, [ null ].concat(util.slice(arguments)));
  });

  body.inherit = inheritor(name, parts, func);

  return body;
}

function asPrimitive(object) {
  return Task.resolve(typeof object.asPrimitive === "function" ?
      object.asPrimitive() : object);
}

function fromPrimitive(value) {
  if (typeof value === "boolean") {
    return defs.bool(value);
  }

  if (typeof value === "number") {
    return defs.number(value);
  }

  if (typeof value === "string") {
    return defs.string(value);
  }

  if (typeof value === "function") {
    return defs.block(value);
  }

  if (util.isArray(value)) {
    return defs.list(value);
  }

  if (value === undefined || value === null) {
    return defs.done;
  }

  return value;
}

function lookup(receiver, pretty, fromSelf) {
  var func, l, name, object, orig, type;

  name = util.uglify(pretty);
  func = receiver[name];

  if (!defs.isGraceObject(receiver) &&
      (typeof func !== "function" || !func.isGraceMethod)) {
    if (typeof func === "function") {
      if (!func.isGraceMethod) {
        orig = func;
        func = method(pretty, function () {
          var self = this;

          return Task.each(util.slice(arguments), asPrimitive)
            .then(function (args) {
              return orig.apply(self, args);
            }).then(fromPrimitive);
        });
      }
    } else if (pretty === "asString") {
      // Use the regular toString in place of asString.
      func = method("asString", 0, function () {
        return defs.string(this.toString());
      });
    } else if (pretty === "at()") {
      func = method("at()", 1, function (index) {
        var self = this;

        return defs.asString(index).then(function (primIndex) {
          return fromPrimitive(self[primIndex]);
        });
      });
    } else if (pretty === "at() put()") {
      func = method("at() put()", [ 1, 1 ], function (index, value) {
        var self = this;

        return defs.asString(index).then(function (primIndex) {
          return asPrimitive(value).then(function (primValue) {
            self[primIndex] = primValue;
            return defs.done;
          });
        });
      });
    } else {
      l = name.length - 2;
      if (name.substring(l) === ":=") {
        name = name.substring(0, l);
        orig = receiver[name];

        // Produce a setter. This provides a mechanism for overwriting functions
        // in the object, which means you could assign a Grace block and have it
        // appear as a method rather than an object. You could replicate this
        // behaviour in Grace anyway, and JavaScript objects are always going to
        // appear a little wonky in Grace, so it's considered acceptable.
        if (typeof orig !== "function" || !orig.isGraceMethod) {
          func = method(pretty, 1, function (value) {
            return asPrimitive(value).then(function (primValue) {
              receiver[name] = primValue;
              return defs.done;
            });
          });
        }
      } else {
        func = receiver[name];

        if (func === undefined) {
          type = typeof receiver;

          if (type === "object" && util.isArray(receiver)) {
            type = "list";
          }

          if (type !== "object") {
            object = defs[type === "boolean" ? "bool" : type](receiver);
            orig = object[name];

            if (typeof orig === "function") {
              func = method(orig.identifer, orig.parts, function () {
                return orig.apply(object, arguments).then(fromPrimitive);
              });
            }
          }

          func = func || defs.base[name];
        } else if (func !== null) {
          if (typeof func !== "function") {
            // Produce a getter. We use name here because there must not be
            // parentheses on the method.
            func = method(name, 0, function () {
              return fromPrimitive(receiver[name]);
            });
          }
        }
      }
    }
  }

  if (typeof func !== "function" ||
      defs.isGraceObject(receiver) && func === Object.prototype[name] ||
          typeof func === "function" && func.internal) {
    return defs.UnresolvedRequest
      .raiseForName_inObject([ defs.string(pretty) ], [ receiver ]);
  }

  if (!fromSelf && func.isConfidential) {
    return defs.UnresolvedRequest
      .raiseConfidentialForName_inObject([ defs.string(pretty) ], [ receiver ]);
  }

  return Task.resolve(func);
}

function call(receiver, meth, args) {
  try {
    return Task.resolve(meth.apply(receiver, args))
      .then(null, handleInternalError);
  } catch (reason) {
    return Task.reject(handleInternalError(reason));
  }
}

// Asynchronous method application that works for either synchronous or
// asynchronous methods.
function apply(receiver, meth, args) {
  if (typeof meth === "string") {
    return lookup(receiver, meth).then(function (foundMethod) {
      return apply(receiver, foundMethod, args);
    });
  }

  if (args === undefined) {
    // The user may optionally pass no arguments, signifying a call to a
    // single-part method with no arguments.
    args = [];
  } else if (args.length === 1 && !util.owns(args[0], "generics")) {
    // If the call is to a single-part method with arguments but no generics, it
    // needs to be removed from the part array to avoid confusing it with a
    // single-argument array. Removing  is equivalent to constructing a true
    // 'part' with the part function from above, but avoids having to create an
    // empty generic list.
    args = args[0];
  }

  return call(receiver, meth, args);
}

// Asynchronous inherits method application that works for either synchronous or
// asynchronous methods. The call throws if the method cannot be inherited from.
function inherit(receiver, meth, inheriting, args) {
  if (typeof meth === "string") {
    return lookup(receiver, meth).then(function (foundMethod) {
      return inherit(receiver, foundMethod, inheriting, args);
    });
  }

  if (typeof meth.inherit !== "function") {
    return defs.InvalidInherits.raiseForName(defs.string(meth.identifier));
  }

  if (args === undefined) {
    // As above, but inherited methods are always multi-part due to the
    // invisible part that takes the inheriting object inserted at the start.
    args = [ [] ];
  }

  args.unshift([ inheriting ]);

  return call(receiver, meth.inherit, args);
}

exports.lookup = lookup;
exports.handleInternalError = handleInternalError;
exports.apply = apply;
exports.inherit = inherit;
exports.part = part;
exports.gte = gte;
exports.trace = trace;
exports.method = method;
exports.inheritor = inheritor;
exports.constructor = constructor;

defs = require("./runtime/definitions");

util.extend(exports, defs);

exports.primitives = require("./runtime/primitives");

exports.prelude = require("./runtime/prelude");

},{"./runtime/definitions":11,"./runtime/prelude":15,"./runtime/primitives":16,"./task":19,"./util":21}],11:[function(require,module,exports){
// Individual objects and helper methods for the runtime.

"use strict";

var Task, bools, done, exceptions, prim, rt, types, util;

Task = require("../task");
prim = require("./primitives");
rt = require("../runtime");
util = require("../util");

function object() {
  return new prim.Object();
}

exports.object = object;

exports.asString = prim.asString;

exports.isGraceObject = function (value) {
  return value instanceof prim.Object;
};

exports.base = prim.Object.prototype;

// block(parameters : Count = gte(0), apply : Function) -> Object
//   Construct a block with an apply method of a certain parameter count.
//
// block((generics : Number, parameters : Count = gte(0)),
//     apply : Function) -> Object
//   Construct a block with a generic apply method of a certain generic count
//   and parameter count.
//
// where Count = Number | GTE
function block(parameters, apply) {
  return new prim.Block(parameters, apply);
}

exports.block = block;

function bool(value) {
  if (value) {
    return bools[true];
  }

  return bools[false];
}

exports.bool = bool;

exports.number = function (value) {
  return new prim.Number(value);
};

function string(value) {
  return new prim.String(value);
}

exports.string = string;

function type(name, generics, extending, signatures) {
  return new prim.Type(name, generics, extending, signatures);
}

exports.type = type;

exports.signature = function (parts, hasVarArg, generics, parameters) {
  return new prim.Signature(parts, hasVarArg, generics, parameters);
};

exports.sigPart = function (name, hasVarArg, generics, parameters) {
  return new prim.Part(name, hasVarArg, generics, parameters);
};

exports.proxy = function (name) {
  return new prim.TypeProxy(name);
};

function pattern(name, match) {
  var pat = new prim.AbstractPattern();

  pat.match = rt.method("match()", 1, match);

  name = string(name);

  pat.asString = rt.method("asString", 0, function () {
    return name;
  });

  return pat;
}

exports.pattern = pattern;

exports.named = function (name, patt) {
  return new prim.NamedPattern(name, patt);
};

function success(value, patt) {
  return new prim.Success(value, patt);
}

exports.success = success;

function failure(value, patt) {
  return new prim.Failure(value, patt);
}

exports.failure = failure;

exports.singleton = function (name, value) {
  return pattern(name, function (against) {
    var self = this;

    return value["=="](against).then(function (eq) {
      return eq.ifTrue_ifFalse([
        rt.block(0, function () {
          return success(against, self);
        })
      ], [
        rt.block(0, function () {
          return failure(against, self);
        })
      ]);
    });
  });
};

exports.match = function (cond, value, patt) {
  return cond ? success(value, patt) : failure(value, patt);
};

exports.equalityMatch = function (value, against) {
  return value["=="](against).then(function (eq) {
    return eq.andAlso_orElse([
      block(0, function () {
        return success(against, value);
      })
    ], [
      block(0, function () {
        return failure(against, value);
      })
    ]);
  });
};

exports.list = function (elements) {
  return new prim.List(elements);
};

exports.listOf = function (patt) {
  return new prim.ListPattern(patt || types.Unknown);
};

exports.set = function (elements) {
  return new prim.Set(elements);
};

exports.entry = function (key, value) {
  return new prim.Entry(key, value);
};

exports.dictionary = function (elements) {
  return new prim.Dictionary(elements);
};

bools = {
  "true": new prim.True(),
  "false": new prim.False()
};

function getBoolean(which) {
  var method, value;

  value = bools[which];

  method = rt.constructor(which.toString(), 0, function (inheriting) {
    if (inheriting !== null) {
      util.extendAll(inheriting, value);
    }

    return value;
  });

  return method;
}

exports.mtrue = getBoolean(true);

exports.mfalse = getBoolean(false);

done = object();

done.asString = rt.method("asString", 0, function () {
  return string("done");
});

exports.done = done;

exports.emptyBlock = block(0, function () {
  return done;
});

types = require("./types");

util.extend(exports, types);

exceptions = require("./exceptions");

util.extend(exports, exceptions);

util.extend(exports, require("./methods"));

util.extend(exports, require("./publicity"));

function isGraceExceptionPacket(value) {
  return value instanceof prim.ExceptionPacket;
}

exports.isGraceExceptionPacket = isGraceExceptionPacket;

exports.isInternalError = function (value) {
  return value instanceof Error ||
      value instanceof exceptions.InternalError.object.Packet;
};

exports.isParseError = function (value) {
  return value instanceof exceptions.ParseFailure.object.Packet;
};

exports.isInterruptError = function (value) {
  return value instanceof Task.InterruptError ||
      value instanceof exceptions.InternalError.object.Packet &&
          value.object.error instanceof Task.InterruptError;
};

function addGenerics(name, generics) {
  return rt.method("asString", 0, function () {
    return rt.string(name + "<")["++"](generics[0]).then(function (str) {
      var comma = rt.string(", ");

      return Task.each(util.slice(generics, 1), function (snd) {
        return str["++"](comma).then(function (fst) {
          return fst["++"](snd).then(function (value) {
            str = value;
          });
        });
      }).then(function () {
        return str;
      });
    }).then(function (init) {
      return init["++"](rt.string(">"));
    });
  });
}

exports.withGenerics = function (name, genericType) {
  var args, i, l;

  function GenericType() {
    this.asString = addGenerics(name, args);
  }

  GenericType.prototype = genericType;

  args = util.slice(arguments, 2);

  for (i = 0, l = args.length; i < l; i += 1) {
    // If any of the generic types isn't Unknown, we produce a different
    // type which has a better stringifier.
    if (args[i] !== rt.Unknown) {
      return new GenericType();
    }
  }

  return genericType;
};

exports.isSubMethod = function (mparts, parts) {
  var generics, i, l, mcount, part, scount;

  for (i = 0, l = mparts.length; i < l; i += 1) {
    part = parts[i];
    generics = part.generics !== undefined ? part.generics.length : part[0];

    mcount = mparts[i][1];
    scount = part.parameters !== undefined ? part.parameters.length : part[1];

    if (generics !== 0 && mparts[i][0] !== generics ||
        (typeof mcount === "number" ? part.hasVarArg || mcount !== scount :
            (part.hasVarArg ? scount - 1 : scount) < mcount.minimum)) {
      return false;
    }
  }

  return true;
};

function newComparison(name, impl) {
  var comp = new prim.Comparison();

  name = string(name);

  comp.ifLessThan_ifEqualTo_ifGreaterThan =
    rt.method("ifLessThan() ifEqualTo() ifGreaterThan()", [ 1, 1, 1 ],
      function (onLessThan, onEqualTo, onGreaterThan) {
        return types.Action.assert(onLessThan[0]).then(function () {
          return types.Action.assert(onEqualTo[0]);
        }).then(function () {
          return types.Action.assert(onGreaterThan[0]);
        }).then(function () {
          return impl(onLessThan[0], onEqualTo[0], onGreaterThan[0]);
        });
      });

  comp.asString = rt.method("asString", 0, function () {
    return name;
  });

  return comp;
}

exports.LessThan = newComparison("Less Than", function (onLessThan) {
  return onLessThan.apply();
});

exports.EqualTo = newComparison("Equal To", function (onLessThan, onEqualTo) {
  return onEqualTo.apply();
});

exports.GreaterThan = newComparison("Greater Than",
  function (onLessThan, onEqualTo, onGreaterThan) {
    return onGreaterThan.apply();
  });

},{"../runtime":10,"../task":19,"../util":21,"./exceptions":12,"./methods":13,"./primitives":16,"./publicity":17,"./types":18}],12:[function(require,module,exports){
// Exceptions native to the language or necessary for the interpreter.

"use strict";

var Err, Exception, LErr, RErr, Task, close, defs, open, prim, rt, str, util;

Task = require("../task");
rt = require("../runtime");
defs = require("./definitions");
prim = require("./primitives");
util = require("../util");

str = defs.string;

open = str("«");
close = str("»");

function asString(object) {
  return rt.apply(object, "asString").then(null, function () {
    return "unrenderable object";
  });
}

function join(string) {
  return Task.each(util.slice(arguments, 1), function (next) {
    return string["++"](next).then(function (concat) {
      string = concat;
    }, function () {
      string += "unrenderable object";
    });
  }).then(function () {
    return string;
  });
}

function addRaise(object, name, signature, func) {
  object[util.uglify("raise" + name)] =
    rt.method("raise" + name, signature, function () {
      return func.apply(this, arguments).then(null, function (packet) {
        packet.object.stackTrace = [];
        throw packet;
      });
    });
}

Exception = new prim.Exception(str("Exception"), prim.ExceptionPacket);

exports.Exception = Exception;

Exception.refine(str("Error")).now(function (Error) {
  var raise, raiseDefault;

  raise = Error.raise;
  raiseDefault = Error.raiseDefault;

  function clearTrace(packet) {
    packet.object.stackTrace = [];
    throw packet;
  }

  addRaise(Error, "()", 1, function (message) {
    return raise.call(this, message).then(null, clearTrace);
  });

  addRaise(Error, "Default", 0, function () {
    return raiseDefault.call(this).then(null, clearTrace);
  });

  Err = Error;
  exports.Error = Error;
});

Err.refine(str("Runtime Error")).now(function (RuntimeError) {
  RErr = RuntimeError;
  exports.RuntimeError = RuntimeError;
});

RErr.refine(str("Internal Error")).now(function (InternalError) {
  var match = InternalError.match;

  addRaise(InternalError, "FromPrimitiveError()", 1, function (error) {
    if (error instanceof Error) {
      return this.raise(str(error.message)).then(null, function (packet) {
        packet.object.error = error;
        throw packet;
      });
    }

    return this.raise(str(error.toString()));
  });

  InternalError.match = rt.method("match()", 1, function (value) {
    if (value instanceof Error) {
      return defs.success(value);
    }

    return match.call(this, value);
  });

  exports.InternalError = InternalError;
});

RErr.refine(str("Incomplete Type")).now(function (IncompleteType) {
  var post, pre;

  pre = str("The type «");
  post = str("» was accessed before it was fully instantiated");

  addRaise(IncompleteType, "ForName()", 1, function (name) {
    var self = this;

    return join(pre, name, post).then(function (message) {
      return self.raise(message);
    });
  });

  exports.IncompleteType = IncompleteType;
});

RErr.refine(str("Incomplete Object")).now(function (IncompleteObject) {
  var post, preName, preSelf;

  preName = str("The implicit receiver of «");
  preSelf = str("«self");
  post = str("» was accessed before it was fully instantiated");

  addRaise(IncompleteObject, "ForName()", 1, function (name) {
    var self = this;

    return join(preName, name, post).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(IncompleteObject, "ForSelf", 0, function () {
    var self = this;

    return join(preSelf, post).then(function (message) {
      return self.raise(message);
    });
  });

  exports.IncompleteObject = IncompleteObject;
});

RErr.refine_defaultMessage([ str("Undefined Value") ],
    [ str("Access of a variable that has not yet had a value defined") ])
  .now(function (UndefinedValue) {
    var post, pre;

    pre = str("Access of a variable «");
    post = str("» that has not yet had a value defined");

    addRaise(UndefinedValue, "ForName()", 1, function (name) {
      var self = this;

      return join(pre, name, post).then(function (message) {
        return self.raise(message);
      });
    });

    exports.UndefinedValue = UndefinedValue;
  });

RErr.refine_defaultMessage([ str("Unmatchable Block") ],
    [ str("Match against a block without exactly one parameter") ])
  .now(function (UnmatchableBlock) {
    exports.UnmatchableBlock = UnmatchableBlock;
  });

RErr.refine(str("Invalid Type")).now(function (InvalidType) {
  var postDep, postDup, preDep, preDup;

  preDup = str("Duplicate method name «");
  postDup = str("» in type «");

  preDep = str("The type «");
  postDep = str("» recursively depends on itself to produce a value");

  addRaise(InvalidType, "DuplicateMethodName() inType()", [ 1, 1 ],
    function (name, type) {
      var self = this;

      return join(preDup, name[0], postDup, type[0], close)
        .then(function (message) {
          return self.raise(message);
        });
    });

  addRaise(InvalidType, "SelfDependencyForType()", 1, function (type) {
    var self = this;

    return join(preDep, type, postDep).then(function (message) {
      return self.raise(message);
    });
  });

  exports.InvalidType = InvalidType;
});

RErr.refine_defaultMessage([ str("Unresolved Request") ],
    [ str("Request for a variable or method which cannot be found") ])
  .now(function (UnresolvedRequest) {
    var post, postAssign, postQualified,
        preAssign, preConf, preMethod, preQualified, preVar;

    preVar = str("Request for a variable or method «");
    preMethod = str("Request for a method «");
    post = str("» which cannot be found");

    preAssign = str("Assignment to variable «");
    postAssign = str("» which cannot be assigned to");

    preQualified = str("Request for an undefined method «");
    postQualified = str("» in «");

    preConf = str("Request for a confidential method «");

    addRaise(UnresolvedRequest, "ForName()", 1, function (rawName) {
      var self = this;

      return rt.String.cast(rawName).then(function (name) {
        return name.asPrimitiveString().then(function (primName) {
          if (/\(\)/.test(primName)) {
            return preMethod;
          }

          return preVar;
        }).then(function (pre) {
          return join(pre, name, post).then(function (message) {
            return self.raise(message);
          });
        });
      });
    });

    addRaise(UnresolvedRequest, "ForAssignToName()", 1, function (name) {
      var self = this;

      return join(preAssign, name, postAssign).then(function (message) {
        return self.raise(message);
      });
    });

    addRaise(UnresolvedRequest, "ForAssignToUnresolvedName()", 1,
      function (name) {
        var self = this;

        return join(preAssign, name, post).then(function (message) {
          return self.raise(message);
        });
      });

    addRaise(UnresolvedRequest, "ForName() inObject()", [ 1, 1 ],
      function (name, obj) {
        var self = this;

        return join(preQualified, name[0], postQualified, obj[0], close)
          .then(function (message) {
            return self.raise(message);
          });
      });

    exports.UnresolvedRequest = UnresolvedRequest;

    addRaise(UnresolvedRequest, "ConfidentialForName() inObject()", [ 1, 1 ],
      function (name, obj) {
        var self = this;

        return join(preConf, name[0], postQualified, obj[0], close)
          .then(function (message) {
            return self.raise(message);
          });
      });
  });

exports.UnresolvedRequest.refine(str("Unresolved Super Request"))
  .now(function (UnresolvedSuperRequest) {
    var post, pre;

    pre = str("Request for an undefined super method «");
    post = str("» in «");

    addRaise(UnresolvedSuperRequest, "ForName() inObject()", [ 1, [ 1 ] ],
      function (name, obj) {
        var self = this;

        return join(pre, name[0], post, obj[0], close).then(function (message) {
          return self.raise(message);
        });
      });

    exports.UnresolvedSuperRequest = UnresolvedSuperRequest;
  });

RErr.refine(str("Invalid Request")).now(function (InvalidRequest) {
  var ne, neGens, postArgVar, postGenVar,
    preMethod, preType, preVar, tm, tmGens;

  preVar = str("Request for variable «");
  preType = str("Request for type «");
  postArgVar = str("» with arguments");
  postGenVar = str("» with generic parameters");

  preMethod = str("Request for method «");
  ne = str("» did not supply enough arguments");
  tm = str("» supplied too many arguments");
  neGens = str("» did not supply enough generic arguments");
  tmGens = str("» supplied too many generic arguments");

  addRaise(InvalidRequest, "GenericsForVariable()", 1, function (name) {
    var self = this;

    return join(preVar, name, postGenVar).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidRequest, "ArgumentsForVariable()", 1, function (name) {
    var self = this;

    return join(preVar, name, postArgVar).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidRequest, "ArgumentsForType()", 1, function (name) {
    var self = this;

    return join(preType, name, postArgVar).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidRequest, "NotEnoughArgumentsForMethod()", 1,
    function (name) {
      var self = this;

      return join(preMethod, name, ne).then(function (message) {
        return self.raise(message);
      });
    });

  addRaise(InvalidRequest, "TooManyArgumentsForMethod()", 1, function (name) {
    var self = this;

    return join(preMethod, name, tm).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidRequest, "NotEnoughGenericArgumentsForMethod()", 1,
    function (name) {
      var self = this;

      return join(preMethod, name, neGens).then(function (message) {
        return self.raise(message);
      });
    });

  addRaise(InvalidRequest, "TooManyGenericArgumentsForMethod()", 1,
    function (name) {
      var self = this;

      return join(preMethod, name, tmGens).then(function (message) {
        return self.raise(message);
      });
    });

  exports.InvalidRequest = InvalidRequest;
});

RErr.refine(str("Invalid Method")).now(function (InvalidMethod) {
  var args, postConf, postParam, postStat, postVar, pre, preConf;

  pre = str("Definition «");
  postParam = str("» has mismatched parameters with its overridden method");
  postConf = str("» overrides a public method");
  preConf = str("Confidential definition «");
  postConf = str("» overrides a public method");
  postStat = str("» overrides a static declaration");
  postVar = str("» is an overriding variable");
  args = str("Multiple variadic arguments in method «");

  addRaise(InvalidMethod, "MismatchedParametersForName()", 1, function (name) {
    var self = this;

    return join(pre, name, postParam).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidMethod, "ConfidentialOverrideForName()", 1, function (name) {
    var self = this;

    return join(preConf, name, postConf).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidMethod, "StaticOverrideForName()", 1, function (name) {
    var self = this;

    return join(pre, name, postStat).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidMethod, "OverridingVariableForName()", 1, function (name) {
    var self = this;

    return join(pre, name, postVar).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidMethod, "MultipleVariadicParametersForName()", 1,
    function (name) {
      var self = this;

      return join(args, name, close).then(function (message) {
        return self.raise(message);
      });
    });

  exports.InvalidMethod = InvalidMethod;
});

RErr.refine_defaultMessage([ str("Redefinition") ],
    [ str("Definition of a name that already exists") ])
  .now(function (Redefinition) {
    var post, pre;

    pre = str("A definition named «");
    post = str("» already exists");

    addRaise(Redefinition, "ForName()", 1, function (name) {
      var self = this;

      return join(pre, name, post).then(function (message) {
        return self.raise(message);
      });
    });

    exports.Redefinition = Redefinition;
  });

RErr.refine(str("Invalid Return")).now(function (InvalidReturn) {
  var completed, object, outside;

  completed = str("Return from a completed method request for «");
  object = str("Return from inside an object constructor");
  outside = str("Return from outside of a method");

  addRaise(InvalidReturn, "ForCompletedMethod()", 1, function (name) {
    var self = this;

    return join(completed, name, close).then(function (message) {
      return self.raise(message);
    });
  });

  addRaise(InvalidReturn, "InsideOfObject", 0, function () {
    return this.raise(object);
  });

  addRaise(InvalidReturn, "OutsideOfMethod", 0, function () {
    return this.raise(outside);
  });

  exports.InvalidReturn = InvalidReturn;
});

RErr.refine_defaultMessage([ str("Invalid Inherits") ],
    [ str("Inherit from method that does not end in an object constructor") ])
  .now(function (InvalidInherits) {
    var post, pre;

    pre = str("Inherit from method «");
    post = str("» that does not end in an object constructor");

    addRaise(InvalidInherits, "ForName()", 1, function (name) {
      var self = this;

      return join(pre, name, post).then(function (message) {
        return self.raise(message);
      });
    });

    exports.InvalidInherits = InvalidInherits;
  });

RErr.refine_defaultMessage([ str("Unresolved Module") ],
    [ str("Unable to locate a module") ])
  .now(function (UnresolvedModule) {
    var post, pre;

    pre = str('Unable to locate a module at the path "');
    post = str('"');

    addRaise(UnresolvedModule, "ForPath()", 1, function (name) {
      var self = this;

      return join(pre, name, post).then(function (message) {
        return self.raise(message);
      });
    });

    exports.UnresolvedModule = UnresolvedModule;
  });

RErr.refine_defaultMessage([ str("Parse Failure") ],
    [ str("Invalid Grace code failed to parse") ])
  .now(function (ParseFailure) {
    exports.ParseFailure = ParseFailure;
  });

Err.refine(str("Logic Error")).now(function (LogicError) {
  LErr = LogicError;
  exports.LogicError = LogicError;
});

LErr.refine_defaultMessage([ str("Assertion Failure") ],
    [ str("Failed to satisfy a required pattern") ])
  .now(function (AssertionFailure) {
    var mid, miss, post;

    mid = str("» failed to satisfy the required pattern «");
    miss = str("» is missing the required method «");
    post = str("» to satisfy the type «");

    addRaise(AssertionFailure, "ForValue() againstPattern()", [ 1, 1 ],
      function (value, pattern) {
        var self = this;

        return asString(value[0]).then(function (string) {
          return join(open, string, mid, pattern[0], close)
            .then(function (message) {
              return self.raise(message);
            });
        });
      });

    addRaise(AssertionFailure, "ForValue() againstType() missing()",
      [ 1, 1, 1 ], function (value, pattern, signature) {
        var self = this;

        return asString(value[0]).then(function (string) {
          return join(open, string, miss, signature[0], post, pattern[0], close)
            .then(function (message) {
              return self.raise(message);
            });
        });
      });

    exports.AssertionFailure = AssertionFailure;
  });

LErr.refine(str("Match Failure")).now(function (MatchFailure) {
  var pre = str("No case branches matched «");

  addRaise(MatchFailure, "ForObject()", 1, function (value) {
    var self = this;

    return join(pre, value, close).then(function (message) {
      return self.raise(message);
    });
  });

  exports.MatchFailure = MatchFailure;
});

LErr.refine(str("No Such Value")).now(function (NoSuchValue) {
  var mid, pre;

  pre = str("No such value «");
  mid = str("» in object «");

  addRaise(NoSuchValue, "ForName() inObject()", [ 1, 1 ],
    function (name, object) {
      var self = this;

      return join(pre, name[0], mid, object[0], close).then(function (message) {
        return self.raise(message);
      });
    });

  exports.NoSuchValue = NoSuchValue;
});

LErr.refine(str("Failed Search")).now(function (FailedSearch) {
  var pre = str("Could not find the object «");

  addRaise(FailedSearch, "ForObject()", 1, function (object) {
    var self = this;

    return join(pre, object, close).then(function (message) {
      return self.raise(message);
    });
  });

  exports.FailedSearch = FailedSearch;
});

LErr.refine_defaultMessage([ str("Out Of Bounds") ],
    [ str("Access of a collection outside of its bounds") ])
  .now(function (OutOfBounds) {
    var post, pre;

    pre = str("Access of a collection at index «");
    post = str("» outside of its bounds");

    addRaise(OutOfBounds, "ForIndex()", 1, function (rawIndex) {
      var self = this;

      return defs.Number.cast(rawIndex).then(function (index) {
        return join(pre, index, post).then(function (message) {
          return self.raise(message);
        });
      });
    });

    exports.OutOfBounds = OutOfBounds;
  });

LErr.refine(str("Not A Number")).now(function (NotANumber) {
  var divide, mid, postOp, postParse, preOp, preParse;

  divide = str("Division by zero");
  preParse = str("Failed to parse «");
  postParse = str("» to a number");

  preOp = str("Applying «");
  mid = str("» to the number «");
  postOp = str("» is not a real number");

  addRaise(NotANumber, "DivideByZero", 0, function () {
    return this.raise(divide);
  });

  addRaise(NotANumber, "ForParse()", 1, function (rawString) {
    var self = this;

    return rt.String.cast(rawString).then(function (string) {
      return asString(string).then(function (primString) {
        return join(preParse, primString, postParse).then(function (message) {
          return self.raise(message);
        });
      });
    });
  });

  addRaise(NotANumber, "ForOperation() on()", [ 1, 1 ], function (name, num) {
    var self = this;

    return join(preOp, name[0], mid, num[0], postOp).then(function (message) {
      return self.raise(message);
    });
  });

  exports.NotANumber = NotANumber;
});

Exception.refine(str("Checker Failure")).now(function (CheckerFailure) {
  CheckerFailure.object.Packet.prototype.nodeOrIfAbsent =
    rt.method("nodeOrIfAbsent", 1, function (action) {
      return rt.Action.assert(action).then(function () {
        return action.apply();
      });
    });

  addRaise(CheckerFailure, "() forNode()", [ 1, 1 ], function (msg, node) {
    msg = msg[0];
    node = node[0];

    return this.raise(msg).then(null, function (packet) {
      packet.object.node = node;

      packet.nodeOrIfAbsent = rt.method("nodeOrIfAbsent", 1, function (action) {
        return rt.Action.assert(action).then(function () {
          return node;
        });
      });

      throw packet;
    });
  });

  addRaise(CheckerFailure, "ForNode()", 1, function (node) {
    return this.raiseDefault().then(null, function (packet) {
      packet.object.node = node;

      packet.nodeOrIfAbsent = rt.method("nodeOrIfAbsent", 1, function (action) {
        return rt.Action.assert(action).then(function () {
          return node;
        });
      });

      throw packet;
    });
  });

  exports.CheckerFailure = CheckerFailure;
});

},{"../runtime":10,"../task":19,"../util":21,"./definitions":11,"./primitives":16}],13:[function(require,module,exports){
// Built-in method definitions.

"use strict";

var Task, defs, dictionary, list, pattern, prim, rt, set, types, util;

Task = require("../task");
rt = require("../runtime");
util = require("../util");

defs = require("./definitions");
prim = require("./primitives");
types = require("./types");

exports.print = rt.method("print()", 1, function (object) {
  return types.String.match(object).then(function (isString) {
    return isString.ifTrue_ifFalse([
      defs.block(0, function () {
        return object;
      })
    ], [
      defs.block(0, function () {
        return rt.apply(object, "asString");
      })
    ]);
  }).then(function (string) {
    return types.String.cast(string).then(function () {
      return string.asPrimitiveString();
    });
  }).then(function (string) {
    console.log(string);
    return defs.done;
  });
});

exports.while_do = rt.method("while() do()", [ 1, 1 ], function (pWbl, pDbl) {
  return types.Action.cast(pWbl[0]).then(function (wbl) {
    return types.Action.cast(pDbl[0]).then(function (dbl) {
      return new Task(function (resolve, reject, task) {
        var ifFalse, ifTrue;

        function apply() {
          if (!task.isStopped) {
            task.waitingOn = wbl.apply().then(function (bool) {
              return bool.ifTrue_ifFalse([ ifTrue ], [ ifFalse ]);
            }).then(null, reject);
          }
        }

        ifTrue = defs.block(0, function () {
          return dbl.apply().then(function () {
            apply();
            return defs.done;
          });
        });

        ifFalse = defs.block(0, function () {
          resolve(defs.done);
          return defs.done;
        });

        // Stopping the inner task may happen too late to avoid triggering a new
        // iteration, which will cause the outer task to report that it has
        // stopped while the loop actually continues. Overriding stop ensures
        // that the no new task is spawned, and the outer task is successfully
        // rejected with the appropriate error.
        task.stop = function () {
          this.isStopped = true;
          Task.prototype.stop.call(task);
        };

        apply();
      });
    });
  });
});

exports.delegateTo = rt.constructor("delegateTo()", rt.gte(1),
  function (object) {
    var delegates;

    object = object || rt.object();

    delegates = util.slice(arguments, 1);

    return Task.each(delegates, function (delegate) {
      util.forProperties(delegate, function (name, value) {
        var method;

        if (object[name] === undefined &&
            typeof value === "function" && !value.isConfidential) {
          method = function () {
            return value.apply(this || object, arguments);
          };

          util.extend(method, value);

          object[name] = method;
        }
      });
    }).then(function () {
      return object;
    });
  });

list = defs.object();

function withAll(object, generics, coll) {
  var part = rt.part(generics, [ coll ]);

  if (object !== null) {
    return this.withAll.inherit.call(this, object, part);
  }

  return this.withAll(part);
}

list.empty = rt.constructor("empty", [ [ 1, 0 ] ], function (object, T) {
  return withAll.call(this, object, [ T ], defs.list([]));
});

list["with"] = rt.constructor("with", [ [ 1, rt.gte(0) ] ],
  function (object, T) {
    return withAll.call(this, object, [ T ],
      defs.list(util.slice(arguments, 2)));
  });

list.withAll = rt.constructor("withAll", [ [ 1, 1 ] ],
  function (object, T, rawColl) {
    var elements = [];

    return rt.Do.cast(rawColl).then(function (coll) {
      return coll["do"](rt.block(1, function (element) {
        return T.assert(element).then(function () {
          elements.push(element);
          return rt.done;
        });
      }));
    }).then(function () {
      var seq = rt.list(elements);

      if (object !== null) {
        util.extendAll(object, seq);
      }

      return seq;
    });
  });

list.asString = rt.method("asString", 0, function () {
  return rt.string("list");
});

exports.list = rt.method("list", 0, function () {
  return list;
});

set = defs.object();

set.empty = rt.constructor("empty", [ [ 1, 0 ] ], function (object, T) {
  return withAll.call(this, object, [ T ], defs.set([]));
});

set["with"] = rt.constructor("with", [ [ 1, rt.gte(0) ] ],
  function (object, T) {
    return withAll
      .call(this, object, [ T ], defs.set(util.slice(arguments, 2)));
  });

set.withAll = rt.constructor("withAll", [ [ 1, 1 ] ],
  function (object, T, rawColl) {
    var aSet = defs.set([]);

    return rt.Do.cast(rawColl).then(function (coll) {
      return coll["do"](rt.block(1, function (add) {
        return T.assert(add).then(function () {
          return aSet.internalPush(add);
        });
      }));
    }).then(function () {
      if (object !== null) {
        util.extendAll(object, aSet);
      }

      return aSet;
    });
  });

set.asString = rt.method("asString", 0, function () {
  return rt.string("set");
});

exports.set = rt.method("set", 0, function () {
  return set;
});

dictionary = defs.object();

dictionary.empty = rt.constructor("empty", [ [ 2, 0 ] ],
  function (object, K, V) {
    return withAll.call(this, object, [ K, V ], defs.dictionary([]));
  });

dictionary["with"] = rt.constructor("with", [ [ 2, rt.gte(0) ] ],
  function (object, K, V) {
    return withAll
      .call(this, object, [ K, V ], defs.dictionary(util.slice(arguments, 3)));
  });

dictionary.withAll = rt.constructor("withAll", [ [ 2, 1 ] ],
  function (object, K, V, rawColl) {
    var aDict = defs.dictionary([]);

    return rt.Do.cast(rawColl).then(function (coll) {
      return coll["do"](rt.block(1, function (rawAdd) {
        return defs.Entry.cast(rawAdd).then(function (add) {
          return add.key().then(function (key) {
            return add.value().then(function (value) {
              return aDict.internalPush(defs.entry(key, value));
            });
          });
        });
      }));
    }).then(function () {
      if (object !== null) {
        util.extendAll(object, aDict);
      }

      return aDict;
    });
  });

dictionary.asString = rt.method("asString", 0, function () {
  return rt.string("dictionary");
});

exports.dictionary = rt.method("dictionary", 0, function () {
  return dictionary;
});

function generate(i, func) {
  var l;

  for (l = 20 + i; i < l; i += 1) {
    func(i);
  }
}

function makeIfThens(tail) {
  generate(0, function (i) {
    var name, parts, pretty;

    pretty = "if() then()" + util.replicate(i, " elseIf() then()").join("") +
      (tail ? " else()" : "");

    name = util.uglify(pretty);

    if (tail) {
      parts = [ 1, [ 1, 1 ] ].concat(util.repeat(i, [ 1, [ 1, 1 ] ]));
      parts.push([ 1, 1 ]);
    } else {
      parts = [ 1, 1 ].concat(util.replicate(i * 2, 1));
    }

    exports[name] = rt.method(pretty, parts, function (pCond) {
      var rawArgs = util.slice(arguments, 1);

      return defs.Boolean.cast(pCond[0]).then(function (cond) {
        var l = rawArgs.length - 1;

        return Task.each(rawArgs, function (arg, j) {
          if (tail && (j === l || j % 2 === 0)) {
            return defs.Action.cast(arg[1]).then(function (action) {
              return [ arg[0], action ];
            });
          }

          return defs.Action.cast(arg[0]);
        }).then(function (args) {
          function repeat(currCond, j) {
            var action;

            action = tail ? rt.block(0, function () {
              return args[j][1].apply().then(function (result) {
                return args[j][0].assert(result).then(function () {
                  return result;
                });
              });
            }) : args[j];

            return currCond.ifTrue_ifFalse([ action ], rt.block(0, function () {
              if (tail && j + 1 === l) {
                return args[l][1].apply().then(function (result) {
                  return args[l][0].assert(result).then(function () {
                    return result;
                  });
                });
              }

              if (j === l) {
                return rt.done;
              }

              return args[j + 1].apply().then(function (nextCond) {
                return defs.Boolean.cast(nextCond);
              }).then(function (nextCond) {
                return repeat(nextCond, j + 2);
              });
            }));
          }

          return repeat(cond, 0).then(tail ? null : function () {
            return rt.done;
          });
        });
      });
    });
  });
}

makeIfThens(false);
makeIfThens(true);

generate(1, function (i) {
  var name, parts, pretty;

  pretty = "match()" + util.replicate(i, " case()").join("");
  name = util.uglify(pretty);

  parts = [ [ i, 1 ] ].concat(util.replicate(i, [ 1, 1 ]));

  exports[name] = rt.method(pretty, parts, function (match) {
    var args, l, patt;

    patt = match[0];
    args = util.slice(arguments, 1);

    l = match.length - 1;

    return Task.each(match.slice(0, l), function (pat) {
      return patt["|"](pat).then(function (orPat) {
        patt = orPat;
      });
    }).then(function () {
      match = match[l];
      return patt.assert(match);
    }).then(function () {
      return Task.each(args, function (arg) {
        return defs.Function.cast(arg[1]).then(function (func) {
          return [ arg[0], func ];
        });
      }).then(function (cases) {
        function repeat(j) {
          if (j === cases.length) {
            return defs.MatchFailure.raiseForObject(match);
          }

          return cases[j][1].match(match).then(function (result) {
            return result
              .ifTrue_ifFalse(rt.part(cases[j][0], rt.block(0, function () {
                return result.value();
              })), [
                rt.block(0, function () {
                  return repeat(j + 1);
                })
              ]);
          });
        }

        return repeat(0);
      });
    });
  });
});

function makeTryCatches(tail) {
  generate(0, function (i) {
    var name, parts, pretty;

    pretty = "try()" + util.replicate(i, " catch()").join("") +
      (tail ? " finally()" : "");

    name = util.uglify(pretty);

    parts = [ [ 1, 1 ] ].concat(util.replicate(i, [ 1, 1 ]));

    if (tail) {
      parts.push(1);
    }

    exports[name] = rt.method(pretty, parts, function (trybl) {
      var args, rawFin;

      args = util.slice(arguments, 1);

      if (tail) {
        rawFin = args.pop();
      }

      return defs.Action.cast(trybl[1]).then(function (action) {
        return Task.each(args, function (arg) {
          return defs.Function.cast(arg[1]).then(function (cat) {
            return [ arg[0], cat ];
          });
        }).then(function (catches) {
          function next(onFin) {
            return action.apply().then(null, rt.handleInternalError)
              .then(function (value) {
                return trybl[0].assert(value).then(function () {
                  return value;
                });
              }, function (packet) {
                function repeat(j) {
                  if (j === catches.length) {
                    return packet.raise();
                  }

                  return catches[j][1].match(packet).then(function (result) {
                    return result.ifTrue_ifFalse([
                      rt.block(0, function () {
                        return result.value().then(function (value) {
                          return catches[j][0].assert(value).then(function () {
                            return value;
                          });
                        });
                      })
                    ], [
                      rt.block(0, function () {
                        return repeat(j + 1);
                      })
                    ]);
                  });
                }

                return repeat(0);
              }).then(onFin, function (packet) {
                function raise() {
                  return packet.raise();
                }

                return onFin().then(raise, raise);
              });
          }

          if (tail) {
            return defs.Action.cast(rawFin).then(function (fin) {
              return next(function (value) {
                return fin.apply().then(function () {
                  return value;
                }, function () {
                  return value;
                });
              });
            });
          }

          return next(Task.resolve);
        });
      });
    });
  });
}

makeTryCatches(false);
makeTryCatches(true);

pattern = defs.object();

pattern["abstract"] = rt.constructor("abstract", 0, function (object) {
  var abs = new prim.AbstractPattern();

  if (!object) {
    return defs.Pattern.assert(abs);
  }

  util.extendAll(object, abs);
  return object;
});

pattern.singleton = rt.constructor("singleton", 0, function (object) {
  var sing = new prim.Singleton();

  if (object) {
    util.extendAll(object, sing);
    return object;
  }

  return sing;
});

pattern.asString = rt.method("asString", 0, function () {
  return defs.string("pattern");
});

exports.pattern = rt.method("pattern", 0, function () {
  return pattern;
});

},{"../runtime":10,"../task":19,"../util":21,"./definitions":11,"./primitives":16,"./types":18}],14:[function(require,module,exports){
// Defines the reflection API for the interpreter.

"use strict";

var defs, prim, rt, util;

rt = require("../runtime");
util = require("../util");

defs = require("./definitions");
prim = require("./primitives");

function Part(name, parameters) {
  this.object = {
    "name": name,
    "parameters": parameters
  };
}

util.inherits(Part, prim.Object);

Part.prototype.name = rt.method("name", 0, function () {
  return defs.string(this.object.name);
});

Part.prototype.generics = rt.method("generics", 0, function () {
  return defs.number(this.object.parameters[0]);
});

Part.prototype.parameters = rt.method("parameters", 0, function () {
  return defs.number(this.object.parameters[1]);
});

Part.prototype.toString = function () {
  var generics, parameters;

  generics = this.object.parameters[0];
  parameters = this.object.parameters[1];

  return this.object.name +
    (generics === 0 ? "" : "<" + generics + ">") +
    (parameters === 0 ? "" : "(" + parameters + ")");
};

Part.prototype.asString = rt.method("asString", 0, function () {
  return defs.string(this.toString());
});

function Method(method) {
  var i, l, mParts, names, parts;

  names = method.identifier.split(" ");
  mParts = method.parts;

  parts = [];

  for (i = 0, l = names.length; i < l; i += 1) {
    parts.push(new Part(names[i].replace("()", ""), mParts[i]));
  }

  this.object = {
    "method": method,
    "parts": parts
  };
}

util.inherits(Method, prim.Object);

Method.prototype.name = rt.method("name", 0, function () {
  return defs.string(this.object.method.identifier);
});

Method.prototype.signature = rt.method("signature", 0, function () {
  return new prim.List(this.object.parts);
});

Method.prototype.toString = function () {
  return "method " + this.object.parts.join(" ");
};

Method.prototype.asString = rt.method("asString", 0, function () {
  return defs.string(this.toString());
});

function Mirror(object) {
  this.object = object;
}

util.inherits(Mirror, prim.Object);

Mirror.prototype.methodNamed_ifAbsent = rt.method("methodNamed() ifAbsent",
  [ 1, [ 1, 1 ] ], function (rawName, onAbsent) {
    var object = this.object;

    rawName = rawName[0];
    onAbsent = onAbsent[1];

    return rt.String.assert(rawName).then(function () {
      return rt.Action.assert(onAbsent);
    }).then(function () {
      return rawName.asPrimitiveString();
    }).then(function (name) {
      var pName;

      if (rt.isGraceObject(object)) {
        pName = util.uglify(name);

        if (util.owns(object, pName) && object[pName].isGraceMethod) {
          return new Method(object[pName]);
        }

        return onAbsent.apply();
      }

      throw new Error("Mirrors not yet implemented for JavaScript objects");
    });
  });

Mirror.prototype.methodNamed = rt.method("methodNamed()", 1, function (name) {
  return this.methodNamed_ifAbsent([ name ], [ rt.block(0, function () {
    return rt.FailedSearch.raiseForObject(name);
  }) ]);
});

Mirror.prototype.methods = rt.method("methods", 0, function () {
  var methods, object;

  object = this.object;
  methods = [];

  if (rt.isGraceObject(object)) {
    util.forProperties(object, function (name, value) {
      if (value.isGraceMethod) {
        methods.push(new Method(value));
      }
    });
  } else {
    throw new Error("Mirrors not yet implemented for JavaScript objects");
  }

  return new prim.Set(methods);
});

Mirror.prototype.asString = rt.method("asString", 0, function () {
  return this.object.asString().then(function (string) {
    return defs.string("mirror[")["++"](string);
  }).then(function (string) {
    return string["++"](defs.string("]"));
  });
});

exports.reflect = rt.method("reflect()", 1, function (object) {
  return new Mirror(object);
});

exports.Mirror = defs.type("Mirror",
  [ defs.signature([ defs.sigPart("methodNamed", [ "name" ]),
      defs.sigPart("ifAbsent", [ "onAbsent" ]) ]),
    defs.signature("methodNamed", [ "name" ]),
    defs.signature("methods")
  ]);

exports.MirrorMethod = defs.type("MirrorMethod",
  [ defs.signature("name"),
    defs.signature("signature")
  ]);

exports.MirrorPart = defs.type("MirrorMethod",
  [ defs.signature("name"),
    defs.signature("generics"),
    defs.signature("parameters")
  ]);

exports.toString = function () {
  return "mirrors";
};

},{"../runtime":10,"../util":21,"./definitions":11,"./primitives":16}],15:[function(require,module,exports){
(function (process){
// Importing this module concurrently loads the system prelude.

"use strict";

var Task, defs, fs, hopper, prelude, rt, util;



Task = require("../task");
defs = require("./definitions");
hopper = require("../hopper");
rt = require("../runtime");
util = require("../util");

// Set up the built-in prelude values.
prelude = defs.object();

function newVar(name, value) {
  return rt.method(name, 0, function () {
    return value;
  });
}

function newType(name, value) {
  var generics = value.object ? value.object.generics : 0;

  return rt.method(name, [ [ generics, 0 ] ], function () {
    return rt.withGenerics
      .apply(null, [ name, value ].concat(util.slice(arguments)));
  });
}

prelude.done = newVar("done", rt.done);

prelude.LessThan = newVar("LessThan", defs.LessThan);
prelude.EqualTo = newVar("EqualTo", defs.EqualTo);
prelude.GreaterThan = newVar("GreaterThan", defs.GreaterThan);

util.extend(prelude, require("./methods"));

util.forProperties(require("./types"), function (name, value) {
  prelude[name] = newType(name, value);
});

function addProperties(list) {
  util.forProperties(list, function (name, value) {
    prelude[name] = newVar(name, value);
  });
}

addProperties(require("./exceptions"));
addProperties(require("./publicity"));

prelude.mirrors = newVar("mirrors", require("./mirrors"));

// The exported prelude is a task, so other actions can wait for it to be ready
// before proceeding with evaluation. Note that it's safe to stop tasks which
// depend on this one, because there is no explicit dependency between this task
// and the internal interpreter.
module.exports = new Task(function (resolve, reject) {
  // The prelude file is read manually so that brfs can statically deposit the
  // code into this file when rendering the script for the browser.
  process.nextTick(function(){(function (readError, code) {
    if (readError !== null) {
        return reject(readError);
    }
    hopper.interpret('prelude', code.toString(), prelude, function (runError) {
        if (runError !== null) {
            reject(runError);
        } else {
            resolve(prelude);
        }
    });
})(null,"method asString -> String {\n  \"prelude\"\n}\n\n// This has to be a method to account for delegation.\nmethod prelude {\n  self\n}\n\nmethod unless(cond : Boolean) then(then : Action) -> Done {\n  cond.orElse(then)\n  done\n}\n\nmethod unless(cond : Boolean)\n    then<T>(then : Action<T>) else<U>(else : Action<U>) -> T | U {\n  cond.andAlso(else) orElse(then)\n}\n\nmethod until(cond : Action<Boolean>) do(action : Action) -> Done {\n  while { !cond.apply } do(action)\n}\n\nmethod for<T>(in : Do<T>) do(f : Procedure<T>) -> Done {\n  in.do(f)\n}\n\ntype ExceptionPattern = {\n  parent -> ExceptionPattern\n\n  refine(name : String) -> ExceptionPattern\n  refine(name : String) defaultMessage(message : String) -> ExceptionPattern\n\n  raise(message : String) -> None\n  raiseDefault -> None\n}\n\ndef EnvironmentException : ExceptionPattern is public =\n  Exception.refine(\"Environment Exception\")\n\ndef ResourceException : ExceptionPattern is public =\n  Exception.refine(\"Resource Exception\")\n\ndef SubobjectResponsibility : ExceptionPattern is public = object {\n  inherits LogicError.refine(\"Subobject Responsibility\")\n\n  method raiseForMethod(name : String) -> None {\n    raise \"A subobject should have overridden the method «{name}»\"\n  }\n}\n\ntype MutableList<T> = List<T> & type {\n  // Insert an element at the given index, overwriting and returning the element\n  // at that position.\n  // Raises an Out Of Bounds if the index is not within the bounds of the list.\n  at(index : Number) put(element : T) -> T\n\n  // Add an element to the end of the list.\n  // Raises an Out Of Bounds if the index is not within the bounds of the list.\n  add(element : T) -> Done\n\n  // Remove and return the element at the given index.\n  removeAt(index : Number) -> T\n\n  // Remove the given element, returning the index where it was found.\n  // Returns the result of the given action if the element is not present.\n  remove(element : T) ifAbsent<U>(action : Action<U>) -> Number | U\n\n  // Remove the given element, returning the index where it was found.\n  // Raises a Failed Search if the element is not present.\n  remove(element : T) -> Number\n}\n\ndef mutableList is public = object {\n  inherits delegateTo(list)\n\n  constructor withAll<T>(elements : Do<T>) -> MutableList<T> {\n    inherits list.withAll<T>(elements)\n\n    method boundsCheck(index : Number) -> Done is confidential {\n      if ((index < 1) || (index > size)) then {\n        OutOfBounds.raiseForIndex(index)\n      }\n    }\n\n    method at(index : Number) put(element : T) -> T {\n      boundsCheck(index)\n      internalSplice(index - 1, 1, element)\n    }\n\n    method add(element : T) -> Done {\n      internalPush(element)\n    }\n\n    method removeAt(index : Number) -> T {\n      boundsCheck(index)\n      internalSplice(index - 1, 1)\n    }\n\n    method remove(element : T) ifAbsent<U>(action : Action<U>) -> Number | U {\n      internalRemove(element, action)\n    }\n\n    method remove(element : T) -> Number {\n      remove(element) ifAbsent<None> {\n        FailedSearch.raiseForObject(element)\n      }\n    }\n\n    method asImmutable -> List<T> {\n      list.withAll(self)\n    }\n  }\n\n  method asString -> String {\n    \"mutableList\"\n  }\n}\n\n\ntype Set<T> = Collection<T> & type {\n  // Produce the concatenation of this set with another, without modifying\n  // either set.\n  ++(set : Set<T>) -> Set<T>\n\n  // Produce an immutable representation of the current state of this set.\n  asImmutable -> Set<T>\n}\n\ntype MutableSet<T> = Set<T> & type {\n  // Add an element to the set.\n  add(element : T) -> Done\n\n  // Remove the given element. Applies the given action if the element is not\n  // present.\n  remove(element : T) ifAbsent(action : Action) -> Done\n\n  // Remove the given element. Raises a Failed Search if the element is not\n  // present.\n  remove(element : T) -> Done\n}\n\ndef mutableSet is public = object {\n  inherits delegateTo(set)\n\n  constructor withAll<T>(elements : Do<T>) -> MutableSet<T> {\n    inherits set.withAll<T>(elements)\n\n    method add(element : T) -> Done {\n      internalPush(element)\n    }\n\n    method remove(element : T) ifAbsent(action : Action) -> Done {\n      internalRemove(element, action)\n      done\n    }\n\n    method remove(element : T) -> Done {\n      remove(element) ifAbsent {\n        FailedSearch.raiseForObject(element)\n      }\n    }\n\n    method asImmutable -> Set<T> {\n      set.withAll(self)\n    }\n  }\n\n  method asString -> String {\n    \"mutableSet\"\n  }\n}\n\nclass entry.key<K>(key' : K) value<V>(value' : V) -> Entry<K, V> {\n  def key : K is public = key'\n  def value : V is public = value'\n\n  method ==(other : Object) -> Boolean {\n    match (other)\n      case { anEntry : Entry<K, V> ->\n        (key == anEntry.key).andAlso {\n          value == anEntry.value\n        }\n      }\n      case { _ -> false }\n  }\n\n  method asString -> String {\n    \"{key.asString} => {value.asString}\"\n  }\n}\n\ntype Dictionary<K, V> = Set<Entry<K, V>> & type {\n  // Whether the dictionary contains the given key.\n  containsKey(key : K) -> Boolean\n\n  // Whether the dictionary contains the given value.\n  containsValue(value : V) -> Boolean\n\n  // Produce an immutable representation of the current state of this\n  // dictionary.\n  asImmutable -> Dictionary<K, V>\n}\n\ntype MutableDictionary<K, V> = Dictionary<K, V> & type {\n  // Add a value at the given key into the dictionary.\n  // Replaces the existing entry if the key is already present.\n  at(key : K) put(value : V) -> Done\n\n  // Add an entry into the dictionary.\n  // Replaces the existing entry if the key is already present.\n  add(entry : Entry<K, V>) -> Done\n\n  // Remove and return the value at the given key.\n  // Returns the result of the given action if the key is not present.\n  removeAt(key : K) ifAbsent<T>(action : Action<T>) -> V | T\n\n  // Remove and return the value at the given key.\n  // Raises a Failed Search if the key is not present.\n  removeAt(key : K) -> V\n\n  // Remove the given entry.\n  // Runs the given action if the entry is not present.\n  remove(element : Entry<K, V>) ifAbsent(action : Action) -> Done\n\n  // Remove the given entry.\n  // Raises a Failed Search if the entry is not present.\n  remove(element : Entry<K, V>) -> Done\n}\n\ndef mutableDictionary is public = object {\n  inherits delegateTo(dictionary)\n\n  constructor withAll<K, V>(elements : Do<Entry<K, V>>)\n      -> MutableDictionary<K, V> {\n    inherits dictionary.withAll<K, V>(elements)\n\n    method at(key : K) put(value : V) -> Done {\n      internalPush(entry.key(key) value(value))\n    }\n\n    method add(entry : Entry<K, V>) -> Done {\n      internalPush(entry)\n    }\n\n    method removeAt(key : K) ifAbsent<T>(action : Action<T>) -> V | T {\n      internalRemoveAt(key, action)\n    }\n\n    method removeAt(key : K) -> V {\n      removeAt(key) ifAbsent {\n        FailedSearch.raiseForObject(key)\n      }\n    }\n\n    method remove(entry : Entry<K, V>) ifAbsent(action : Action) -> Done {\n      internalRemove(entry, action)\n      done\n    }\n\n    method remove(entry : Entry<K, V>) -> Done {\n      remove(entry) ifAbsent {\n        FailedSearch.raiseForObject(entry)\n      }\n\n      done\n    }\n\n    method asImmutable -> Dictionary<K, V> {\n      dictionary.withAll(self)\n    }\n  }\n\n  method asString -> String {\n    \"mutableDictionary\"\n  }\n}\n\ndef … : Unknown = object {\n  method … {\n    self\n  }\n\n  method asString -> String {\n    \"…\"\n  }\n}\n")});
});

}).call(this,require('_process'))
},{"../hopper":3,"../runtime":10,"../task":19,"../util":21,"./definitions":11,"./exceptions":12,"./methods":13,"./mirrors":14,"./publicity":17,"./types":18,"_process":27}],16:[function(require,module,exports){
// Primitive Grace definitions in JavaScript.

"use strict";

var Task, defs, rt, util;

Task = require("../task");
rt = require("../runtime");
defs = require("./definitions");
util = require("../util");

function addMethod(Constructor, name) {
  Constructor.prototype[util.uglify(name)] =
    rt.method.apply(rt, util.slice(arguments, 1));
}

function addConstructor(Constructor, name) {
  Constructor.prototype[util.uglify(name)] =
    rt.constructor.apply(rt, util.slice(arguments, 1));
}

function toNumber(raw) {
  return defs.Number.cast(raw).then(function (number) {
    return number.asPrimitiveNumber();
  });
}

function toString(raw) {
  return defs.String.cast(raw).then(function (string) {
    return string.asPrimitiveString();
  });
}

function GraceObject() {
  return this;
}

GraceObject.isInternal = true;

addMethod(GraceObject, "==", 1, function (value) {
  return defs.bool(this === value);
});

addMethod(GraceObject, "!=", 1, function (value) {
  return this["=="](value).then(function (result) {
    return result["prefix!"]().then(function (notted) {
      return defs.Boolean.assert(notted).then(function () {
        return notted;
      });
    });
  });
});

addMethod(GraceObject, "asString", 0, function () {
  return defs.string("object");
});

function asString(value) {
  return rt.apply(value, "asString").then(function (string) {
    return toString(string);
  });
}

exports.asString = asString;

GraceObject.prototype.toString = function () {
  var error, string;

  string = null;
  error = null;

  asString(this).now(function (value) {
    string = value;
  }, rt.handleInternalError).then(null, function (reason) {
    error = new Error("Unable to render exception message");

    reason.exception().then(function (exception) {
      return exception.name().then(function (name) {
        return toString(name).then(function (nameString) {
          error.name = nameString;
        });
      });
    }).then(function () {
      return reason.message().then(function (message) {
        return toString(message).then(function (messageString) {
          error.message = messageString;
        });
      });
    }).now();
  });

  if (error !== null) {
    throw error;
  }

  if (string === null || string.toString === GraceObject.prototype.toString) {
    return "object";
  }

  return string.toString();
};

GraceObject.prototype.toString.isInternal = true;

function AbstractPattern() {
  return this;
}

util.inherits(AbstractPattern, GraceObject);

function dirPattern(name, branch) {
  return function (rawRhs) {
    var self = this;

    return defs.Pattern.cast(rawRhs).then(function (rhs) {
      var pattern = new AbstractPattern();

      pattern.match = rt.method("match()", 1, function (value) {
        return self.match(value).then(function (rawMatch) {
          return defs.Boolean.cast(rawMatch).then(function (match) {
            return match[branch](defs.block(0, function () {
              return rhs.match(value);
            }));
          });
        });
      });

      pattern.asString = rt.method("asString", 0, function () {
        return self.asString().then(function (string) {
          return rt.string(name + "(")["++"](string);
        }).then(function (string) {
          return string["++"](rt.string(", "));
        }).then(function (string) {
          return rt.apply(rhs, "asString").then(function (rhsString) {
            return string["++"](rhsString);
          });
        }).then(function (string) {
          return string["++"](rt.string(")"));
        });
      });

      return pattern;
    });
  };
}

addMethod(AbstractPattern, "&", 1, dirPattern("Both", "andAlso"));

addMethod(AbstractPattern, "|", 1, dirPattern("Either", "orElse"));

addMethod(AbstractPattern, "assert()", 1, function (value) {
  var packet, self;

  self = this;
  packet = null;

  return self.match(value).then(function (result) {
    return result.orElse(defs.block(0, function () {
      return defs.AssertionFailure
        .raiseForValue_againstPattern([ value ], [ self ])
        .then(null, function (error) {
          packet = error;
          throw packet;
        });
    }));
  }).then(null, function () {
    var trace;

    if (packet !== null) {
      trace = packet.object.stackTrace;
      trace.splice(trace.length - 3, 3);
    }

    throw packet;
  });
});

addMethod(AbstractPattern, "asString", 0, function () {
  return defs.string("object(pattern.abstract)");
});

function Singleton() {
  AbstractPattern.call(this);
}

util.inherits(Singleton, AbstractPattern);

addMethod(Singleton, "match()", 1, function (value) {
  return this === value ? defs.success(value) : defs.failure(value);
});

addMethod(Singleton, "asString", 0, function () {
  return defs.string("object(pattern.singleton)");
});

function Block(parameters, apply) {
  var paramCount;

  AbstractPattern.call(this);

  paramCount = typeof parameters === "number" ? parameters : parameters[1];

  this.apply =
    rt.method("apply" + (paramCount === 0 ? "" : "()"), [ parameters ], apply);

  this.asString = rt.method("asString", 0, function () {
    return defs.string("block/" + paramCount);
  });

  if (paramCount === 1) {
    this.match = rt.method("match()", 1, function (object) {
      var self = this;

      return self.apply(object).then(function (result) {
        return defs.success(result, self);
      });
    });
  }
}

util.inherits(Block, AbstractPattern);

addMethod(Block, "asPrimitive", function () {
  return this.apply;
});

addMethod(Block, "match()", 1, function () {
  return rt.UnmatchableBlock.raiseDefault();
});

function AbstractBoolean() {
  AbstractPattern.call(this);
}

util.inherits(AbstractBoolean, AbstractPattern);

addMethod(AbstractBoolean, "match()", 1, function (against) {
  return defs.equalityMatch(this, against);
});

addMethod(AbstractBoolean, "ifTrue()", 1, function (action) {
  var self = this;

  return defs.Action.assert(action).then(function () {
    return self.ifTrue_ifFalse([ action ], [ defs.emptyBlock ]);
  }).then(function () {
    return rt.done;
  });
});

addMethod(AbstractBoolean, "ifFalse()", 1, function (action) {
  var self = this;

  return defs.Action.assert(action).then(function () {
    return self.ifTrue_ifFalse([ defs.emptyBlock ], [ action ]);
  }).then(function () {
    return rt.done;
  });
});

addMethod(AbstractBoolean, "andAlso() orElse()", [ 1, 1 ], function (fst, snd) {
  var self = this;

  fst = fst[0];
  snd = snd[0];

  return defs.Action.assert(fst).then(function () {
    return defs.Action.assert(snd);
  }).then(function () {
    return self.ifTrue_ifFalse(rt.part([ defs.Boolean ], fst),
      rt.part([ defs.Boolean ], snd));
  });
});

addMethod(AbstractBoolean, "andAlso()", 1, function (action) {
  var self = this;

  return defs.Action.assert(action).then(function () {
    return self.ifTrue_ifFalse(rt.part([ defs.Boolean ], [ action ]),
      rt.part([ defs.Boolean ], [
        defs.block(0, function () {
          return self;
        })
      ]));
  });
});

addMethod(AbstractBoolean, "orElse()", 1, function (action) {
  var self = this;

  // TODO Type check parameters, pass generics.
  return self.ifTrue_ifFalse([
    defs.block(0, function () {
      return self;
    })
  ], [ action ]);
});

addMethod(AbstractBoolean, "&&", 1, function (rhs) {
  var self = this;

  return defs.Boolean.assert(rhs).then(function () {
    return self.andAlso(defs.block(0, function () {
      return rhs;
    }));
  });
});

addMethod(AbstractBoolean, "||", 1, function (rhs) {
  var self = this;

  return defs.Boolean.assert(rhs).then(function () {
    return self.orElse(defs.block(0, function () {
      return rhs;
    }));
  });
});

addMethod(AbstractBoolean, "prefix!", 0, function () {
  return this.andAlso_orElse([
    defs.block(0, function () {
      return defs.bool(false);
    })
  ], [
    defs.block(0, function () {
      return defs.bool(true);
    })
  ]);
});

addMethod(AbstractBoolean, "asBoolean", 0, function () {
  return this.andAlso_orElse([
    defs.block(0, function () {
      return defs.bool(true);
    })
  ], [
    defs.block(0, function () {
      return defs.bool(false);
    })
  ]);
});

addMethod(AbstractBoolean, "asPrimitive", 0, function () {
  return this.asPrimitiveBoolean();
});

function addIfTrueIfFalse(Ctor, index) {
  addMethod(Ctor, "ifTrue() ifFalse()", [ [ 1, 1 ], [ 1, 1 ] ], function () {
    var action, part;

    part = arguments[index];
    action = part[1];

    // TODO Type check arguments and result.
    return action.apply();
  });
}

function True() {
  return this;
}

util.inherits(True, AbstractBoolean);

addIfTrueIfFalse(True, 0);

addMethod(True, "asPrimitiveBoolean", 0, function () {
  return true;
});

addMethod(True, "asString", 0, function () {
  return defs.string("true");
});

function False() {
  return this;
}

util.inherits(False, AbstractBoolean);

addIfTrueIfFalse(False, 1);

addMethod(False, "asPrimitiveBoolean", 0, function () {
  return false;
});

addMethod(False, "asString", 0, function () {
  return defs.string("false");
});

function binaryOp(func, type) {
  return function (rawRhs) {
    var self = this;

    return defs[type].cast(rawRhs).then(function (rhs) {
      return self["asPrimitive" + type]().then(function (fst) {
        return rhs["asPrimitive" + type]().then(function (snd) {
          return func(fst, snd);
        });
      });
    });
  };
}

function Comparison() {
  AbstractPattern.call(this);
}

util.inherits(Comparison, Singleton);

addMethod(Comparison, "ifLessThan()", 1, function (onLessThan) {
  var self = this;

  return defs.Action.assert(onLessThan).then(function () {
    return self.ifLessThan_ifEqualTo_ifGreaterThan([ onLessThan ],
      [ defs.emptyBlock ], [ defs.emptyBlock ]).then(function () {
        return defs.done;
      });
  });
});

addMethod(Comparison, "ifEqualTo()", 1, function (onEqualTo) {
  var self = this;

  return defs.Action.assert(onEqualTo).then(function () {
    return self.ifLessThan_ifEqualTo_ifGreaterThan([ defs.emptyBlock ],
      [ onEqualTo ], [ defs.emptyBlock ]).then(function () {
        return defs.done;
      });
  });
});

addMethod(Comparison, "ifGreaterThan()", 1, function (onGreaterThan) {
  var self = this;

  return defs.Action.assert(onGreaterThan).then(function () {
    return self.ifLessThan_ifEqualTo_ifGreaterThan([ defs.emptyBlock ],
      [ defs.emptyBlock ], [ onGreaterThan ]).then(function () {
        return defs.done;
      });
  });
});

addMethod(Comparison, "ifLessThan() ifEqualTo()", [ 1, 1 ],
  function (onLessThan, onEqualTo) {
    var self = this;

    return defs.Action.assert(onLessThan[0]).then(function () {
      return defs.Action.assert(onEqualTo[0]);
    }).then(function () {
      return self.ifLessThan_ifEqualTo_ifGreaterThan(onLessThan,
        onEqualTo, [ defs.emptyBlock ]).then(function () {
          return defs.done;
        });
    });
  });

addMethod(Comparison, "ifLessThan() ifGreaterThan()", [ 1, 1 ],
  function (onLessThan, onGreaterThan) {
    var self = this;

    return defs.Action.assert(onLessThan[0]).then(function () {
      return defs.Action.assert(onGreaterThan[0]);
    }).then(function () {
      return self.ifLessThan_ifEqualTo_ifGreaterThan(onLessThan,
        [ defs.emptyBlock ], onGreaterThan).then(function () {
          return defs.done;
        });
    });
  });

addMethod(Comparison, "ifEqualTo() ifGreaterThan()", [ 1, 1 ],
  function (onEqualTo, onGreaterThan) {
    var self = this;

    return defs.Action.assert(onEqualTo[0]).then(function () {
      return defs.Action.assert(onGreaterThan[0]);
    }).then(function () {
      return self.ifLessThan_ifEqualTo_ifGreaterThan([ defs.emptyBlock ],
        onEqualTo, onGreaterThan).then(function () {
          return defs.done;
        });
    });
  });

// TODO Implement arbitrary size.
function GraceNumber(value) {
  AbstractPattern.call(this);

  value = Number(value);

  this.asPrimitiveNumber = rt.method("asPrimitiveNumber", 0, function () {
    return value;
  });
}

util.inherits(GraceNumber, AbstractPattern);

addMethod(GraceNumber, "asPrimitive", 0, function () {
  return this.asPrimitiveNumber();
});

addMethod(GraceNumber, "==", 1, function (rhs) {
  var self = this;

  return defs.Number.match(rhs).then(function (isNumber) {
    return isNumber.andAlso_orElse([
      defs.block(0, function () {
        return self.asPrimitiveNumber().then(function (primSelf) {
          return rhs.asPrimitiveNumber().then(function (primRhs) {
            return defs.bool(primSelf === primRhs);
          });
        });
      })
    ], [
      defs.block(0, function () {
        return defs.bool(false);
      })
    ]);
  });
});

addMethod(GraceNumber, "match()", 1, function (against) {
  return defs.equalityMatch(this, against);
});

addMethod(GraceNumber, "prefix-", 0, function () {
  return this.asPrimitiveNumber().then(function (value) {
    return defs.number(-value);
  });
});

function binaryNum(func) {
  return binaryOp(function (fst, snd) {
    return new GraceNumber(func(fst, snd));
  }, "Number");
}

function binaryNumCmp(func) {
  return binaryOp(function (fst, snd) {
    return defs.bool(func(fst, snd));
  }, "Number");
}

addMethod(GraceNumber, "+", 1, binaryNum(function (fst, snd) {
  return fst + snd;
}));

addMethod(GraceNumber, "-", 1, binaryNum(function (fst, snd) {
  return fst - snd;
}));

addMethod(GraceNumber, "*", 1, binaryNum(function (fst, snd) {
  return fst * snd;
}));

addMethod(GraceNumber, "/", 1, binaryOp(function (fst, snd) {
  if (snd === 0) {
    return rt.NotANumber.raiseDivideByZero().then(null, function (packet) {
      packet.object.stackTrace = [];
      throw packet;
    });
  }

  return new GraceNumber(fst / snd);
}, "Number"));

addMethod(GraceNumber, "%", 1, binaryNum(function (fst, snd) {
  return fst % snd;
}));

addMethod(GraceNumber, "^", 1, binaryNum(function (fst, snd) {
  return Math.pow(fst, snd);
}));

addMethod(GraceNumber, "compareTo()", 1, binaryOp(function (fst, snd) {
  return fst < snd ? defs.LessThan :
    fst > snd ? defs.GreaterThan : defs.EqualTo;
}, "Number"));

addMethod(GraceNumber, "<", 1, binaryNumCmp(function (fst, snd) {
  return fst < snd;
}));

addMethod(GraceNumber, "<=", 1, binaryNumCmp(function (fst, snd) {
  return fst <= snd;
}));

addMethod(GraceNumber, ">", 1, binaryNumCmp(function (fst, snd) {
  return fst > snd;
}));

addMethod(GraceNumber, ">=", 1, binaryNumCmp(function (fst, snd) {
  return fst >= snd;
}));

function addMath(name, method, arg) {
  method = method || name;

  addMethod(GraceNumber, name, 0, function () {
    return this.asPrimitiveNumber().then(function (value) {
      var result = Math[method](value, arg);

      if (isNaN(result)) {
        return defs.NotANumber.raiseForOperation_on([ method ], [ value ]);
      }

      return new GraceNumber(result);
    });
  });
}

addMath("absolute", "abs");
addMath("round");
addMath("floor");
addMath("ceiling", "ceil");
addMath("log");
addMath("exponent", "exp");
addMath("sin");
addMath("cos");
addMath("tan");
addMath("asin");
addMath("acos");
addMath("atan");
addMath("square", "pow", 2);
addMath("cube", "pow", 3);
addMath("squareRoot", "sqrt");

addMethod(GraceNumber, "asString", 0, function () {
  return this.asPrimitiveNumber().then(function (value) {
    return defs.string(value.toString());
  });
});

function GraceString(value) {
  AbstractPattern.call(this);

  value = String(value);
  this.asPrimitiveString = rt.method("asPrimitiveString", function () {
    return value;
  });
}

util.inherits(GraceString, AbstractPattern);

addMethod(GraceString, "asPrimitive", 0, function () {
  return this.asPrimitiveString();
});

addMethod(GraceString, "==", 1, function (rhs) {
  var self = this;

  return defs.String.match(rhs).then(function (isNumber) {
    return isNumber.andAlso_orElse([
      defs.block(0, function () {
        return self.asPrimitiveString().then(function (primSelf) {
          return rhs.asPrimitiveString().then(function (primRhs) {
            return defs.bool(primSelf === primRhs);
          });
        });
      })
    ], [
      defs.block(0, function () {
        return defs.bool(false);
      })
    ]);
  });
});

addMethod(GraceString, "match()", 1, function (against) {
  return defs.equalityMatch(this, against);
});

addMethod(GraceString, "at()", 1, function (rawIndex) {
  return defs.Number.cast(rawIndex).then(function (index) {
    return this.asPrimitiveString().then(function (string) {
      return index.asPrimitiveNumber().then(function (primIndex) {
        return defs.string(string[primIndex - 1]);
      });
    });
  });
});

addMethod(GraceString, "size", 0, function () {
  return this.asPrimitiveString().then(function (string) {
    return rt.number(string.length);
  });
});

addMethod(GraceString, "contains()", 1, function (rawSubString) {
  var self = this;

  return defs.String.cast(rawSubString).then(function (subString) {
    return subString.asPrimitiveString().then(function (primSubString) {
      return self.asPrimitiveString().then(function (primSelf) {
        return defs.bool(primSelf.substring(primSubString) >= 0);
      });
    });
  });
});

addMethod(GraceString, "do()", 1, function (rawAction) {
  var self = this;

  return defs.Function.cast(rawAction).then(function (action) {
    return self.asPrimitiveString().then(function (string) {
      return Task.each(string, function (character) {
        return action.apply(defs.string(character));
      });
    }).then(function () {
      return defs.done;
    });
  });
});

function binaryStrCmp(func) {
  return binaryOp(function (fst, snd) {
    return defs.bool(func(fst, snd));
  }, "String");
}

addMethod(GraceString, "compareTo()", 1, binaryOp(function (fst, snd) {
  return fst < snd ? defs.LessThan :
    fst > snd ? defs.GreaterThan : defs.EqualTo;
}, "String"));

addMethod(GraceString, "<", 1, binaryStrCmp(function (fst, snd) {
  return fst < snd;
}));

addMethod(GraceString, "<=", 1, binaryStrCmp(function (fst, snd) {
  return fst <= snd;
}));

addMethod(GraceString, ">", 1, binaryStrCmp(function (fst, snd) {
  return fst > snd;
}));

addMethod(GraceString, ">=", 1, binaryStrCmp(function (fst, snd) {
  return fst >= snd;
}));

addMethod(GraceString, "++", 1, function (rhs) {
  var self = this;

  return self.asPrimitiveString().then(function (primSelf) {
    return defs.String.match(rhs).then(function (isString) {
      return isString.andAlso_orElse([
        defs.block(0, function () {
          return rhs;
        })
      ], [
        defs.block(0, function () {
          return rt.apply(rhs, "asString");
        })
      ]).then(function (snd) {
        return snd.asPrimitiveString().then(function (primSnd) {
          return defs.string(primSelf + primSnd);
        });
      });
    });
  });
});

addMethod(GraceString, "fold() startingWith()", [ [ 1, 1 ], 1 ],
  function (part, value) {
    var pattern, self;

    self = this;
    pattern = part[0];
    value = value[0];

    return defs.Function2.cast(part[1]).then(function (fold) {
      return self["do"](rt.block(1, function (element) {
        return fold.apply(value, element).then(function (result) {
          return pattern.assert(result).then(function () {
            value = result;
            return rt.done;
          });
        });
      })).then(function () {
        return value;
      });
    });
  });

addMethod(GraceString, "asNumber", 0, function () {
  var self = this;

  return self.asPrimitiveString().then(function (value) {
    var number = Number(value);

    if (isNaN(number)) {
      return rt.NotANumber.raiseForParse(self).then(null, function (packet) {
        packet.object.stackTrace = [];
        throw packet;
      });
    }

    return defs.number(number);
  });
});

addMethod(GraceString, "substringFrom() to()", [ 1, 1 ], function (pFrom, pTo) {
  var self = this;

  return toNumber(pFrom[0]).then(function (from) {
    return toNumber(pTo[0]).then(function (to) {
      return self.asPrimitiveString().then(function (primSelf) {
        if (from < 1 || from > primSelf.length + 1) {
          return defs.OutOfBounds.raiseForIndex(defs.number(from));
        }

        if (to < 1 || to > primSelf.length + 1) {
          return defs.OutOfBounds.raiseForIndex(defs.number(to));
        }

        return defs.string(primSelf.substring(from - 1, to));
      });
    });
  });
});

addMethod(GraceString, "substringFrom() size()", [ 1, 1 ],
  function (pFrom, pSize) {
    var self = this;

    return toNumber(pFrom[0]).then(function (from) {
      return toNumber(pSize[0]).then(function (size) {
        return self.asPrimitiveString().then(function (primSelf) {
          var to = from + size;

          if (from < 1 || from > primSelf.length + 1) {
            return defs.OutOfBounds.raiseForIndex(defs.number(from));
          }

          if (to < 1 || to > primSelf.length + 1) {
            return defs.OutOfBounds.raiseForIndex(defs.number(to));
          }

          return defs.string(primSelf.substring(from - 1, to - 1));
        });
      });
    });
  });

addMethod(GraceString, "substringFrom()", 1, function (from) {
  var self = this;

  return self.asPrimitiveString().then(function (string) {
    return self.substringFrom_to([ from ], [ defs.number(string.length + 1) ]);
  });
});

addMethod(GraceString, "substringTo()", 1, function (to) {
  return this.substringFrom_to([ defs.number(1) ], [ to ]);
});

addMethod(GraceString, "replace() with()", [ 1, 1 ], function (pFrom, pTo) {
  var self = this;

  return toString(pFrom[0]).then(function (from) {
    return toString(pTo[0]).then(function (to) {
      return self.asPrimitiveString().then(function (primSelf) {
        return defs.string(primSelf.replace(from, to));
      });
    });
  });
});

addMethod(GraceString, "startsWith()", 1, function (rawPrefix) {
  var self = this;

  return toString(rawPrefix).then(function (prefix) {
    return self.asPrimitiveString().then(function (primSelf) {
      var index = prefix.length;

      return defs.bool(index > primSelf.length ? false :
        primSelf.lastIndexOf(prefix, index) === 0);
    });
  });
});

addMethod(GraceString, "endsWith()", 1, function (rawSuffix) {
  var self = this;

  return toString(rawSuffix).then(function (suffix) {
    return self.asPrimitiveString().then(function (primSelf) {
      var index = primSelf.length - suffix.length;

      return defs.bool(index < 0 ? false :
        primSelf.indexOf(suffix, index) === index);
    });
  });
});

function addIndexOfs(forwards) {
  var defaultStart, method, name;

  method = forwards ? "indexOf" : "lastIndexOf";
  name = method + "_startingAt_ifAbsent";

  defaultStart = forwards ? function () {
    return Task.resolve(defs.number(1));
  } : function (string) {
    return string.asPrimitiveString().then(function (primString) {
      return defs.number(primString.length);
    });
  };

  addMethod(GraceString, method + "() startingAt() ifAbsent()",
    [ 1, 1, [ 1, 1 ] ], function (pSearch, pFrom, pIfAbsent) {
      var self = this;

      return toString(pSearch[0]).then(function (search) {
        return toNumber(pFrom[0]).then(function (from) {
          return defs.Action.cast(pIfAbsent[1]).then(function (absent) {
            return self.asPrimitiveString().then(function (primSelf) {
              var index;

              if (from < 0 || from > primSelf.length ||
                  from === 0 && primSelf.length !== 0) {
                return defs.OutOfBounds.raiseForIndex(defs.number(from));
              }

              index = primSelf[method](search, from - 1);

              if (index < 0) {
                return absent.apply().then(function (result) {
                  return pIfAbsent[0].assert(result).then(function () {
                    return result;
                  });
                });
              }

              return defs.number(index + 1);
            });
          });
        });
      });
    });

  addMethod(GraceString, method + "()", 1, function (search) {
    var self = this;

    return defaultStart(self).then(function (from) {
      return self[name]([ search ], [ from ], [
        defs.block(0, function () {
          return defs.FailedSearch.raiseForObject(search);
        })
      ]);
    });
  });

  addMethod(GraceString, method + "() startingAt()", [ 1, 1 ],
    function (search, from) {
      var self = this;

      return self[name](search, from, [
        defs.block(0, function () {
          return defs.FailedSearch.raiseForObject(search);
        })
      ]);
    });

  addMethod(GraceString, method + "() ifAbsent()", [ 1, [ 1, 1 ] ],
    function (search, absent) {
      var self = this;

      return defaultStart(self).then(function (from) {
        return self[name](search, [ from ], rt.part(absent[0], absent[1]));
      });
    });
}

addIndexOfs(true);
addIndexOfs(false);

addMethod(GraceString, "asImmutable", 0, function () {
  return this;
});

addMethod(GraceString, "asString", 0, function () {
  return this.asPrimitiveString().then(function (value) {
    return defs.string("\"" + util.escape(value) + "\"");
  });
});

function Part(name, hasVarArg, generics, parameters) {
  if (typeof hasVarArg !== "boolean") {
    parameters = generics;
    generics = hasVarArg;
    hasVarArg = false;
  }

  if (generics === undefined) {
    parameters = [];
    generics = [];
  } else if (parameters === undefined) {
    parameters = generics;
    generics = [];
  }

  this.name = name;
  this.hasVarArg = hasVarArg;
  this.generics = generics;
  this.parameters = parameters;
}

Part.prototype.pretty = function () {
  return this.name + (this.parameters.length > 0 ? "()" : "");
};

Part.prototype.toString = function () {
  var generics, params;

  generics = this.generics;
  params = this.parameters;

  return this.name +
    (generics.length > 0 ? "<" + generics.join(", ") + ">" : "") +
    (params.length > 0 ? "(" + params.join(", ") + ")" : "");
};

function Signature(parts, hasVarArg, generics, parameters) {
  if (typeof parts === "string") {
    this.parts = [ new Part(parts, hasVarArg, generics, parameters) ];
  } else {
    this.parts = util.map(parts, function (part) {
      if (typeof part === "string") {
        return new Part(part, false, [], []);
      }

      return part;
    });
  }
}

Signature.prototype.name = function () {
  var i, l, name, parts;

  parts = this.parts;
  name = [];

  for (i = 0, l = parts.length; i < l; i += 1) {
    name.push(parts[i].pretty());
  }

  return name.join(" ");
};

Signature.prototype.toString = function () {
  return this.parts.join(" ");
};

function hasSignatures(pattern) {
  return pattern.object !== "undefined" &&
    util.isArray(pattern.object.signatures);
}

// A proxy for hoisted type declarations that will be filled out with the values
// of a real type once the actual value is built. As such, the proxy can be
// combined with other patterns and be tested for equality, but it cannot be
// matched or stringified.
function TypeProxy(name) {
  var self = this;

  this.object = {
    "dependents": [],

    "become": function (pattern) {
      var pname;

      if (pattern instanceof TypeProxy && pattern.object.become) {
        pattern.object.dependents.push(this);
        return Task.resolve();
      }

      if (pattern.object && pattern.object.signatures) {
        this.signatures = pattern.object.signatures;
      }

      for (pname in pattern) {
        if (!self.hasOwnProperty(pname) && pattern[pname] !== self[name]) {
          self[pname] = pattern[pname];
        }
      }

      delete this.become;

      return Task.each(this, this.dependents, function (dependent) {
        return dependent.become(self);
      }).then(function () {
        delete this.dependents;
      });
    }
  };

  if (name !== null) {
    this.asString = rt.method("asString", 0, function () {
      return defs.string(name);
    });
  }
}

util.inherits(TypeProxy, AbstractPattern);

addMethod(TypeProxy, "match()", 1, function () {
  return this.asString().then(function (name) {
    return defs.IncompleteType.raiseForName(name);
  });
});

function andWaitOn(andTask, lhs, rhs) {
  return andTask.then(function (and) {
    var become, hasLhs, hasRhs, proxy;

    proxy = new TypeProxy(null);
    proxy.asString = and.asString;

    if (lhs instanceof TypeProxy && lhs.object.become) {
      lhs.object.dependents.push(proxy.object);
      hasLhs = false;
    } else {
      hasLhs = true;
    }

    if (rhs instanceof TypeProxy && rhs.object.become) {
      rhs.object.dependents.push(proxy.object);
      hasRhs = false;
    } else {
      hasRhs = true;
    }

    become = proxy.object.become;
    proxy.object.become = function (becoming) {
      if (becoming === lhs && !hasRhs) {
        hasLhs = true;
      } else if (becoming === rhs && !hasLhs) {
        hasRhs = true;
      } else {
        return lhs["&"](rhs).then(function (joint) {
          return become.call(proxy.object, joint);
        });
      }

      return Task.resolve();
    };

    return proxy;
  });
}

addMethod(TypeProxy, "&", 1, function (pattern) {
  var and = AbstractPattern.prototype["&"].call(this, pattern);

  if (!(pattern instanceof TypeProxy || hasSignatures(pattern))) {
    return and;
  }

  return andWaitOn(and, this, pattern);
});

function Type(name, generics, extending, signatures) {
  var i, l;

  if (typeof name !== "string") {
    signatures = extending;
    extending = generics;
    generics = name;
    name = null;
  }

  if (typeof generics !== "number") {
    signatures = extending;
    extending = generics;
    generics = 0;
  }

  if (signatures === undefined) {
    signatures = extending;
    extending = null;
  } else if (util.isArray(extending)) {
    for (i = 0, l = extending.length; i < l; i += 1) {
      signatures = signatures.concat(extending[i].object.signatures);
    }
  } else {
    signatures = signatures.concat(extending.object.signatures);
  }

  this.object = {
    "generics": generics,
    "signatures": signatures
  };

  if (name !== null) {
    name = defs.string(name);

    this.asString = rt.method("asString", 0, function () {
      return name;
    });
  }
}

util.inherits(Type, AbstractPattern);

function typeMatch(type, value, onFail) {
  var i, l, method, name, parts, signature, signatures;

  signatures = type.object.signatures;

  for (i = 0, l = signatures.length; i < l; i += 1) {
    signature = signatures[i];
    name = signature.name();
    method = value[util.uglify(name)];
    parts = signature.parts;

    if (method === undefined) {
      return onFail(value, type, name);
    }

    if (typeof method === "function" && method.parts !== undefined) {
      if (!defs.isSubMethod(method.parts, parts)) {
        return onFail(value, type, name);
      }
    }
  }

  return defs.success(value, type);
}

addMethod(Type, "match()", 1, function (value) {
  return typeMatch(this, value, defs.failure);
});

addMethod(Type, "assert()", 1, function (value) {
  return typeMatch(this, value, function (val, type, name) {
    return defs.AssertionFailure.raiseForValue_againstType_missing([ val ],
      [ type ], [ rt.string(name) ]);
  });
});

addMethod(Type, "cast()", 1, function (value) {
  var self = this;

  return self.assert(value).then(function () {
    var i, l, name, object, pretty, signatures;

    if (defs.isGraceObject(value)) {
      return value;
    }

    signatures = self.object.signatures;

    object = defs.object();

    function makeMethod(mname) {
      return function () {
        return value[mname].apply(value, arguments);
      };
    }

    for (i = 0, l = signatures.length; i < l; i += 1) {
      pretty = signatures[i].name();
      name = util.uglify(pretty);

      object[name] = rt.method(pretty, makeMethod(name));
    }

    if (typeof value.object === "object") {
      object.object = value.object;
    }

    return object;
  });
});

addMethod(Type, "&", 1, function (pattern) {
  var andTask, self;

  self = this;
  andTask = AbstractPattern.prototype["&"].call(this, pattern);

  if (pattern instanceof TypeProxy && pattern.object.become) {
    return andWaitOn(andTask, this, pattern);
  }

  if (!hasSignatures(pattern)) {
    return andTask;
  }

  return andTask.then(function (and) {
    var type =
      new Type(self.object.signatures.concat(pattern.object.signatures));

    type.asString = and.asString;

    return type;
  });
});

addMethod(Type, "asString", 0, function () {
  var sep, signatures;

  signatures = this.object.signatures;
  sep = signatures.length === 0 ? "" : " ";

  return defs.string("type {" + sep + signatures.join("; ") + sep + "}");
});

function NamedPattern(name, pattern) {
  this.name = rt.method("name", function () {
    return name;
  });

  this.pattern = rt.method("pattern", function () {
    return pattern;
  });
}

util.inherits(NamedPattern, AbstractPattern);

addMethod(NamedPattern, "match()", 1, function (value) {
  return this.pattern().then(function (pattern) {
    return pattern.match(value);
  });
});

addMethod(NamedPattern, "assert()", 1, function (value) {
  return this.pattern().then(function (pattern) {
    return pattern.assert(value);
  });
});

addMethod(NamedPattern, "asString", 0, function () {
  var self = this;

  return this.name().then(function (name) {
    return self.pattern().then(function (pattern) {
      return defs.string(name.toString() +
          (pattern === defs.Unknown ? "" : " : " + pattern));
    });
  });
});

function matchAsString(name) {
  return function () {
    return this.value().then(function (value) {
      return asString(value).then(function (string) {
        return defs.string(name + "(" + string + ")");
      });
    });
  };
}

function Success(value, pattern) {
  True.call(this);

  this.value = rt.method("value", 0, function () {
    return value;
  });

  this.pattern = rt.method("pattern", 0, function () {
    return pattern;
  });
}

util.inherits(Success, True);

addMethod(Success, "asString", 0, matchAsString("success"));

function Failure(value, pattern) {
  False.call(this);

  this.value = rt.method("value", 0, function () {
    return value;
  });

  this.pattern = rt.method("pattern", 0, function () {
    return pattern;
  });
}

util.inherits(Failure, False);

addMethod(Failure, "asString", 0, matchAsString("failure"));

// Collects the elements of a collection using the do() method.
function getElements(value) {
  var elements = [];

  return value["do"](defs.block(1, function (element) {
    elements.push(element);
    return rt.done;
  })).then(function () {
    return elements;
  });
}

// A private definition used for all collections which store their elements
// internally in an array.
function InternalArray(elements, open, close) {
  this.object = {
    "elements": elements,
    "open": open,
    "close": close
  };
}

util.inherits(InternalArray, GraceObject);

addMethod(InternalArray, "size", 0, function () {
  return defs.number(this.object.elements.length);
});

addMethod(InternalArray, "isEmpty", 0, function () {
  return defs.bool(this.object.elements.length === 0);
});

addMethod(InternalArray, "do()", 1, function (action) {
  var elements = this.object.elements;

  return defs.Function.assert(action).then(function () {
    return Task.each(elements, function (element) {
      return action.apply(element);
    });
  }).then(function () {
    return defs.done;
  });
});

addMethod(InternalArray, "contains()", 1, function (value) {
  return new Task(this, function (resolve, reject) {
    return Task.each(this.object.elements, function (element) {
      return rt.apply(element, "==", [ [ value ] ]).then(function (isEqual) {
        return isEqual.andAlso(rt.block(0, function () {
          resolve(isEqual);
          return Task.never();
        }));
      });
    }).then(function () {
      resolve(defs.bool(false));
    }, reject);
  });
});

addMethod(InternalArray, "concatenate", 0, function () {
  var joining = defs.string("");

  return this["do"](rt.block(1, function (element) {
    return joining["++"](element).then(function (joined) {
      joining = joined;
      return defs.done;
    });
  })).then(function () {
    return joining;
  });
});

addMethod(InternalArray, "concatenateSeparatedBy()", 1, function (sep) {
  var joining, once;

  joining = defs.string("");
  once = false;

  return this["do"](rt.block(1, function (element) {
    return (once ? joining["++"](sep) : (once = true, Task.resolve(joining)))
      .then(function (part) {
        return part["++"](element);
      }).then(function (joined) {
        joining = joined;
        return defs.done;
      });
  })).then(function () {
    return joining;
  });
});

addMethod(InternalArray, "fold() startingWith()", [ [ 1, 1 ], 1 ],
  function (fold, value) {
    var pattern = fold[0];

    fold = fold[1];
    value = value[0];

    return this["do"](rt.block(1, function (element) {
      return fold.apply(value, element).then(function (result) {
        return pattern.assert(result).then(function () {
          value = result;
          return rt.done;
        });
      });
    })).then(function () {
      return value;
    });
  });

addMethod(InternalArray, "asPrimitiveArray", 0, function () {
  return this.object.elements.concat();
});

addMethod(InternalArray, "asPrimitive", 0, function () {
  return Task.each(this.object.elements, function (element) {
    if (typeof element.asPrimitive === "function") {
      return element.asPrimitive();
    }

    return element;
  });
});

addMethod(InternalArray, "asString", 0, function () {
  var close, comma, elements, open;

  elements = this.object.elements;

  open = this.object.open;
  close = this.object.close;

  if (elements.length === 0) {
    return defs.string(open + close);
  }

  elements = elements.concat();
  comma = defs.string(", ");

  return defs.string(open)["++"](elements.shift()).then(function (string) {
    return Task.each(elements, function (element) {
      return rt.apply(element, "asString").then(function (stringified) {
        return string["++"](comma).then(function (commaed) {
          return commaed["++"](stringified).then(function (replacement) {
            string = replacement;
          });
        });
      });
    }).then(function () {
      return string["++"](defs.string(close));
    });
  });
});

addMethod(InternalArray, "internalPush()", 1, function (element) {
  this.object.elements.push(element);
  return rt.done;
});

InternalArray.prototype.internalPush.isConfidential = true;

addMethod(InternalArray, "internalRemove()", 2, function (remove, rawAction) {
  var elements = this.object.elements;

  return defs.Action.cast(rawAction).then(function (action) {
    return new Task(function (resolve, reject) {
      return Task.each(elements, function (element, i) {
        return rt.apply(element, "==", [ remove ]).then(function (bool) {
          return bool.ifTrue(rt.block(0, function () {
            elements.splice(i, 1);
            resolve(defs.number(i + 1));
            return Task.never();
          }));
        });
      }).then(function () {
        return action.apply().then(function (result) {
          resolve(result);
        });
      }).then(null, reject);
    });
  });
});

InternalArray.prototype.internalRemove.isConfidential = true;

addMethod(InternalArray, "internalSplice()", rt.gte(2),
  function (rawIndex, rawAmount) {
    var additions, elements;

    elements = this.object.elements;
    additions = util.slice(arguments, 2);

    return toNumber(rawIndex).then(function (index) {
      return toNumber(rawAmount).then(function (amount) {
        return elements
          .splice.apply(elements, [ index, amount ].concat(additions))[0];
      });
    });
  });

InternalArray.prototype.internalSplice.isConfidential = true;

addMethod(InternalArray, "asImmutable", 0, function () {
  return this;
});

function List(elements) {
  InternalArray.call(this, elements, "[", "]");
}

util.inherits(List, InternalArray);

addMethod(List, "at()", 1, function (num) {
  var elements = this.object.elements;

  return toNumber(num).then(function (index) {
    if (index < 1 || index > elements.length) {
      return defs.OutOfBounds.raiseForIndex(num);
    }

    return elements[index - 1];
  });
});

addMethod(List, "first", 0, function () {
  return this.at(defs.number(1));
});

addMethod(List, "last", 0, function () {
  return this.at(defs.number(this.object.elements.length));
});

addMethod(List, "indices", 0, function () {
  var i, indices, l;

  indices = [];

  for (i = 1, l = this.object.elements.length; i <= l; i += 1) {
    indices.push(defs.number(i));
  }

  return new List(indices);
});

addMethod(List, "++", 1, function (rhs) {
  var elements = this.object.elements;

  return defs.Do.cast(rhs).then(function () {
    return getElements(rhs).then(function (rhsElements) {
      return defs.list(elements.concat(rhsElements));
    });
  });
});

addMethod(List, "sliceFrom() to()", [ 1, 1 ], function (rawFrom, rawTo) {
  var elements = this.object.elements;

  return toNumber(rawFrom).then(function (from) {
    if (from < 1 || from > elements.length + 1) {
      return defs.OutOfBounds.raiseForIndex(defs.number(from));
    }

    return toNumber(rawTo).then(function (to) {
      if (to < 1 || to > elements.length + 1) {
        return defs.OutOfBounds.raiseForIndex(defs.number(to));
      }

      return new List(elements.slice(from - 1, to - 1));
    });
  });
});

addMethod(List, "sliceFrom() to()", [ 1, 1 ], function (rawFrom, rawTo) {
  var elements = this.object.elements;

  return toNumber(rawFrom).then(function (from) {
    if (from < 1 || from > elements.length + 1) {
      return defs.OutOfBounds.raiseForIndex(defs.number(from));
    }

    return toNumber(rawTo).then(function (to) {
      if (to < 1 || to > elements.length + 1) {
        return defs.OutOfBounds.raiseForIndex(defs.number(to));
      }

      return new List(elements.slice(from - 1, to - 1));
    });
  });
});

addMethod(List, "sliceFrom()", 1, function (from) {
  return this.sliceFrom_to(from, defs.number(this.object.elements.length + 1));
});

addMethod(List, "sliceTo()", 1, function (to) {
  return this.sliceFrom_to(defs.number(1), to);
});

function ListPattern(pattern) {
  this.pattern = rt.method("pattern", 0, function () {
    return pattern;
  });
}

util.inherits(ListPattern, AbstractPattern);

addMethod(ListPattern, "match()", 1, function (list) {
  var self = this;

  return self.pattern().then(function (pattern) {
    return new Task(function (resolve, reject) {
      defs.List.match(list).then(function (isList) {
        return isList.ifTrue_ifFalse([
          defs.block(0, function () {
            return list["do"](defs.block(1, function (value) {
              return new Task(function (next, rejectIter) {
                pattern.match(value).then(function (matched) {
                  return matched.ifTrue_ifFalse([
                    defs.block(0, function () {
                      next(rt.done);
                      return Task.never();
                    })
                  ], [
                    defs.block(0, function () {
                      resolve(defs.failure(list, self));
                      return Task.never();
                    })
                  ]);
                }).then(null, rejectIter);
              });
            })).then(function () {
              return defs.success(list, self);
            });
          })
        ], [
          defs.block(0, function () {
            return defs.failure(list, self);
          })
        ]);
      }).then(resolve, reject);
    });
  });
});

addMethod(ListPattern, "asString", 0, function () {
  return this.pattern().then(function (pattern) {
    return asString(pattern).then(function (string) {
      return defs.string("List<" + string + ">");
    });
  });
});

function Set(elements) {
  InternalArray.call(this, elements, "{", "}");
}

util.inherits(Set, InternalArray);

addMethod(Set, "++", 1, function (rhs) {
  var newElements, self;

  self = this;
  newElements = this.object.elements.concat();

  return defs.Do.cast(rhs).then(function () {
    return rhs["do"](rt.block(1, function (element) {
      return self.contains(element).then(function (bool) {
        return bool.ifFalse(rt.block(0, function () {
          newElements.push(element);
          return rt.done;
        }));
      });
    }));
  }).then(function () {
    return defs.set(newElements);
  });
});

addMethod(Set, "internalPush", 1, function (value) {
  var self = this;

  return this.contains(value).then(function (bool) {
    return bool.ifFalse(rt.block(0, function () {
      return InternalArray.prototype.internalPush.call(self, value);
    }));
  });
});

function Entry(key, value) {
  this.object = {
    "key": key,
    "value": value
  };
}

addMethod(Entry, "key", 0, function () {
  return this.object.key;
});

addMethod(Entry, "value", 0, function () {
  return this.object.value;
});

addMethod(Entry, "==", 1, function (rawRhs) {
  var key, value;

  key = this.object.key;
  value = this.object.value;

  return defs.Entry.match(rawRhs).then(function (isEntry) {
    return isEntry.ifTrue_ifFalse([ rt.block(0, function () {
      return defs.Entry.cast(rawRhs).then(function (rhs) {
        return rhs.key().then(function (rhsKey) {
          return rt.apply(key, "==", [ [ rhsKey ] ]);
        }).then(function (bool) {
          return bool.andAlso(rt.block(0, function () {
            return rhs.value().then(function (rhsValue) {
              return rt.apply(value, "==", [ [ rhsValue ] ]);
            });
          }));
        });
      });
    }) ], [ rt.block(0, function () {
      return defs.bool(false);
    }) ]);
  });
});

addMethod(Entry, "asString", 0, function () {
  var key, value;

  key = this.object.key;
  value = this.object.value;

  return rt.apply(key, "asString").then(function (keyString) {
    return rt.apply(value, "asString").then(function (valueString) {
      return keyString["++"](defs.string(" => ")).then(function (cat) {
        return cat["++"](valueString);
      });
    });
  });
});

function internalEntry(entry) {
  if (entry instanceof Entry) {
    return Task.resolve(entry);
  }

  return entry.key().then(function (key) {
    return entry.value().then(function (value) {
      return new Entry(key, value);
    });
  });
}

function Dictionary(elements) {
  InternalArray.call(this, elements, "{", "}");
}

util.inherits(Dictionary, InternalArray);

addMethod(Dictionary, "keys", 0, function () {
  return Task.each(this.object.elements, function (entry) {
    return entry.key();
  }).then(function (keys) {
    return new Set(keys);
  });
});

addMethod(Dictionary, "values", 0, function () {
  return Task.each(this.object.elements, function (entry) {
    return entry.value();
  }).then(function (keys) {
    return new Set(keys);
  });
});

addMethod(Dictionary, "at() ifAbsent()", [ 1, 1 ],
  function (key, onAbsent) {
    var elements = this.object.elements;

    return rt.Action.assert(onAbsent).then(function () {
      return new Task(function (resolve, reject) {
        return Task.each(elements, function (entry) {
          return entry.key().then(function (rawKey) {
            return rt.Object.cast(rawKey);
          }).then(function (eKey) {
            return rt.apply(eKey, "==", [ key ]).then(function (bool) {
              return bool.ifTrue(rt.block(0, function () {
                return entry.value().then(function (value) {
                  resolve(value);
                  return Task.never();
                });
              }));
            });
          });
        }).then(function () {
          return onAbsent[0].apply();
        }).then(resolve, reject);
      });
    });
  });

addMethod(Dictionary, "at()", 1, function (key) {
  return this.at_ifAbsent([ key ], [ rt.block(0, function () {
    return defs.FailedSearch.raiseForObject(key);
  }) ]);
});

addMethod(Dictionary, "at() do()", [ 1, 1 ], function (key, proc) {
  var elements = this.object.elements;

  return defs.Procedure.assert(proc[0]).then(function () {
    return new Task(function (resolve, reject) {
      return Task.each(elements, function (entry) {
        return entry.key().then(function (eKey) {
          return rt.apply(eKey, "==", [ key ]).then(function (bool) {
            return bool.ifTrue(rt.block(0, function () {
              return entry.value().then(function (value) {
                return proc[0].apply(value);
              }).then(function () {
                resolve(rt.done);
                return Task.never();
              });
            }));
          });
        });
      }).then(function () {
        resolve(rt.done);
      }, reject);
    });
  });
});

addMethod(Dictionary, "containsKey()", 1, function (key) {
  var elements = this.object.elements;

  return new Task(function (resolve, reject) {
    return Task.each(elements, function (entry) {
      return entry.key().then(function (eKey) {
        return rt.apply(eKey, "==", [ [ key ] ]).then(function (bool) {
          return bool.ifTrue(rt.block(0, function () {
            resolve(bool);
            return Task.never();
          }));
        });
      });
    }).then(function () {
      resolve(defs.bool(false));
    }).then(null, reject);
  });
});

addMethod(Dictionary, "containsValue()", 1, function (value) {
  var elements = this.object.elements;

  return new Task(function (resolve, reject) {
    return Task.each(elements, function (entry) {
      return entry.value().then(function (eValue) {
        return rt.apply(eValue, "==", [ [ value ] ]).then(function (bool) {
          return bool.ifTrue(rt.block(0, function () {
            resolve(bool);
            return Task.never();
          }));
        });
      });
    }).then(function () {
      resolve(defs.bool(false));
    }).then(null, reject);
  });
});

addMethod(Dictionary, "++", 1, function (rhs) {
  var newElements, self;

  self = this;
  newElements = this.object.elements.concat();

  return defs.Do.assert(rhs).then(function () {
    return rhs["do"](rt.block(1, function (entry) {
      return entry.key().then(function (key) {
        return self.containsKey(key).then(function (bool) {
          return bool.ifFalse(rt.block(0, function () {
            return internalEntry(entry).then(function (intEntry) {
              newElements.push(intEntry);
              return rt.done;
            });
          }));
        });
      });
    }));
  }).then(function () {
    return defs.dictionary(newElements);
  });
});

addMethod(Dictionary, "internalPush()", 1, function (entry) {
  var elements = this.object.elements;

  return entry.key().then(function (key) {
    return new Task(function (resolve, reject) {
      return Task.each(elements, function (element, i) {
        return element.key().then(function (elKey) {
          return rt.apply(elKey, "==", [ [ key ] ]).then(function (bool) {
            return bool.ifTrue(rt.block(0, function () {
              return internalEntry(entry).then(function (intEntry) {
                elements.splice(i, 1, intEntry);
                resolve(rt.done);
                return Task.never();
              });
            }));
          });
        });
      }).then(function () {
        return internalEntry(entry).then(function (intEntry) {
          elements.push(intEntry);
          resolve(rt.done);
        });
      }).then(null, reject);
    });
  });
});

addMethod(Dictionary, "internalRemoveAt()", 2, function (key, rawAction) {
  var elements = this.object.elements;

  return defs.Action.cast(rawAction).then(function (action) {
    return new Task(function (resolve, reject) {
      return Task.each(elements, function (element, i) {
        return element.key().then(function (elKey) {
          return rt.apply(elKey, "==", [ [ key ] ]).then(function (bool) {
            return bool.ifTrue(rt.block(0, function () {
              resolve(elements.splice(i, 1)[0]);
              return Task.never();
            }));
          });
        });
      }).then(function () {
        return action.apply().then(resolve);
      }).then(null, reject);
    });
  });
});

function Trace(name, object, location) {
  var self = this;

  if (location === undefined) {
    location = object;
    object = null;
  }

  this.name = rt.method("name", 0, function () {
    return defs.string(name);
  });

  this.receiver = rt.method("receiver", 0, object === null ? function () {
    return defs.NoSuchValue
      .raiseForName_inObject([ defs.string("receiver") ], [ this ]);
  } : function () {
    return defs.string(object);
  });

  this.receiverOrIfAbsent = rt.method("receiverOrIfAbsent()", [ [ 1, 1 ] ],
    function (pAbsent) {
      var pattern = pAbsent[0];

      return defs.Action.cast(pAbsent[1]).then(function (absent) {
        if (object === null) {
          return absent.apply().then(function (result) {
            return pattern.assert(result).then(function () {
              return result;
            });
          });
        }

        return defs.string(object);
      });
    });

  function fromLocation(mname, type, prop) {
    self[mname] = rt.method(mname, 0,
      location === null || location[prop] === null ? function () {
        return defs.NoSuchValue
          .raiseForName_inObject([ defs.string(mname) ], [ self ]);
      } : function () {
        return defs[type](location[prop]);
      });

    self[mname + "OrIfAbsent"] = rt.method(mname + "OrIfAbsent", [ [ 1, 1 ] ],
      function (pAbsent) {
        var pattern = pAbsent[0];

        return defs.Action.cast(pAbsent[1]).then(function (absent) {
          if (location === null || location[prop] === null) {
            return absent.apply().then(function (result) {
              return pattern.assert(result).then(function () {
                return result;
              });
            });
          }

          return defs[type](location[prop]);
        });
      });
  }

  fromLocation("moduleName", "string", "module");
  fromLocation("lineNumber", "number", "line");
  fromLocation("columnNumber", "number", "column");

  this.asString = rt.method("asString", 0, function () {
    var trace = "at «" + name + "»";

    if (object !== null) {
      trace += " in «" + object + "»";
    }

    if (location !== null) {
      trace += " from ";

      if (location.module !== null) {
        trace += '"' + location.module + '" ';
      }

      trace += "(line " + location.line + ", column " + location.column + ")";
    }

    return defs.string(trace);
  });
}

util.inherits(Trace, GraceObject);

function Backtrace(traces) {
  List.call(this, traces);
}

util.inherits(Backtrace, List);

addMethod(Backtrace, "asString", 0, function () {
  var nl, once;

  nl = defs.string("\n");
  once = false;

  return this.fold_startingWith(rt.part(defs.String,
    rt.block(2, function (string, next) {
      return (once ? string["++"](nl) : Task.resolve(string))
        .then(function (preString) {
          once = true;
          return preString["++"](next);
        });
    })), [ defs.string("") ]);
});

function ExceptionPacket(exception, message) {
  if (message === undefined) {
    this.asString = rt.method("asString", 0, function () {
      return exception.name();
    });
  }

  message = message || defs.string("");

  this.exception = rt.method("exception", 0, function () {
    return exception;
  });

  this.message = rt.method("message", 0, function () {
    return message;
  });

  this.object = {
    "stackTrace": []
  };
}

util.inherits(ExceptionPacket, GraceObject);

function traceProperty(packet, name, type) {
  var i, l, location, trace;

  trace = packet.object.stackTrace;

  for (i = 0, l = trace.length; i < l; i += 1) {
    location = trace[i].location;

    if (location !== null && location[name] !== null) {
      return defs[type](location[name]);
    }
  }

  return defs.NoSuchValue
    .raiseForName_inObject([ defs.string(name) ], [ packet ]);
}

addMethod(ExceptionPacket, "moduleName", 0, function () {
  return traceProperty(this, "module", "string");
});

addMethod(ExceptionPacket, "lineNumber", 0, function () {
  return traceProperty(this, "line", "number");
});

addMethod(ExceptionPacket, "columnNumber", 0, function () {
  return traceProperty(this, "column", "number");
});

addMethod(ExceptionPacket, "backtrace", 0, function () {
  var backtrace, i, l, stack, trace;

  stack = this.object.stackTrace;
  backtrace = [];

  for (i = 0, l = stack.length; i < l; i += 1) {
    trace = stack[i];
    backtrace.push(new Trace(trace.name, trace.object, trace.location));
  }

  return new Backtrace(backtrace);
});

addMethod(ExceptionPacket, "raise", 0, function () {
  throw this;
});

addMethod(ExceptionPacket, "asString", 0, function () {
  var self = this;

  return self.exception().then(function (exception) {
    return exception.name().then(function (name) {
      return self.message().then(function (message) {
        return defs.string(": ")["++"](message).then(function (string) {
          return name["++"](string);
        });
      });
    });
  });
});

function Exception(name, Packet, parent) {
  this.object = {
    "name": name,
    "Packet": Packet
  };

  this.parent = rt.method("parent", 0, parent === undefined ? function () {
    return this;
  } : function () {
    return parent;
  });
}

util.inherits(Exception, AbstractPattern);

addMethod(Exception, "name", 0, function () {
  return this.object.name;
});

addMethod(Exception, "raise()", 1, function (message) {
  throw new this.object.Packet(this, message);
});

addMethod(Exception, "raiseDefault", 0, function () {
  throw new this.object.Packet(this);
});

addConstructor(Exception, "refine()", 1, function (inherit, name) {
  var Packet, self;

  self = this;
  Packet = this.object.Packet;

  function ChildPacket(exception, message) {
    Packet.call(this, exception, message);
  }

  util.inherits(ChildPacket, Packet);

  function ChildException() {
    Exception.call(this, name, ChildPacket, self);
  }

  ChildException.prototype = this;

  if (inherit !== null) {
    util.extendAll(inherit, ChildException.prototype);
    ChildException.call(inherit);
  }

  return Task.resolve(new ChildException());
});

addConstructor(Exception, "refine() defaultMessage()", [ 1, 1 ],
  function (inherit, name, defMessage) {
    var Packet, self;

    self = this;
    Packet = this.object.Packet;

    name = name[0];
    defMessage = defMessage[0];

    function ChildPacket(exception, message) {
      Packet.call(this, exception, message || defMessage);
    }

    util.inherits(ChildPacket, Packet);

    function ChildException() {
      Exception.call(this, name, ChildPacket, self);
    }

    ChildException.prototype = this;

    if (inherit !== null) {
      util.extendAll(inherit, ChildException.prototype);
      ChildException.call(inherit);
    }

    return Task.resolve(new ChildException());
  });

addMethod(Exception, "match()", 1, function (value) {
  return Task.resolve(defs.match(value instanceof this.object.Packet,
    value, this));
});

addMethod(Exception, "asString", 0, function () {
  return this.name();
});

exports.Object = GraceObject;
exports.Block = Block;
exports.AbstractBoolean = AbstractBoolean;
exports.True = True;
exports.False = False;
exports.Comparison = Comparison;
exports.String = GraceString;
exports.Number = GraceNumber;
exports.AbstractPattern = AbstractPattern;
exports.Singleton = Singleton;
exports.Part = Part;
exports.Signature = Signature;
exports.Type = Type;
exports.TypeProxy = TypeProxy;
exports.NamedPattern = NamedPattern;
exports.Success = Success;
exports.Failure = Failure;
exports.List = List;
exports.ListPattern = ListPattern;
exports.Set = Set;
exports.Entry = Entry;
exports.Dictionary = Dictionary;
exports.Exception = Exception;
exports.ExceptionPacket = ExceptionPacket;

},{"../runtime":10,"../task":19,"../util":21,"./definitions":11}],17:[function(require,module,exports){
// Publicity annotation definitions.

"use strict";

var defs, rt, util;

rt = require("../runtime");
defs = require("./definitions");
util = require("../util");

function setName(name, object) {
  name = defs.string(name);
  object.asString = rt.method("asString", 0, function () {
    return name;
  });

  return object;
}

function addMethod(object, name, func, params) {
  object[util.uglify(name)] = rt.method(name, params || 1, func);
  return object;
}

function newAnnotation(name, func) {
  var annotation = defs.object();

  setName(name, annotation);

  addMethod(annotation, "annotateMethod()", func);
  addMethod(annotation, "annotateDef()", func);
  addMethod(annotation, "annotateClass()", func);
  addMethod(annotation, "annotateType()", func);

  addMethod(annotation, "annotateVar()", function (reader, writer) {
    func(reader);
    return func(writer);
  }, 2);

  return annotation;
}

function makePublic(method) {
  delete method.isConfidential;
  return rt.done;
}

exports["public"] = newAnnotation("public", makePublic);

exports.confidential = newAnnotation("confidential", function (method) {
  method.isConfidential = true;
  return rt.done;
});

exports.readable = setName("readable",
  addMethod(defs.object(), "annotateVar()", makePublic, 2));

exports.writable = setName("writable",
  addMethod(defs.object(), "annotateVar()", function (reader, writer) {
    return makePublic(writer);
  }, 2));

},{"../runtime":10,"../util":21,"./definitions":11}],18:[function(require,module,exports){
// Built-in type definitions.

"use strict";

var Bool, Collection, Do, Foreign, List, Node, Ordered, Pattern,
    ast, defs, rt, type, util, visitor;

ast = require("../ast");
visitor = require("../ast/visitor");
rt = require("../runtime");
util = require("../util");

defs = require("./definitions");
type = require("./definitions").type;

exports.Object = type("Object", [ ]);

exports.None = defs.pattern("None", defs.failure);

exports.Unknown = defs.pattern("Unknown", function (object) {
  return defs.success(object);
});

Foreign = defs.pattern("Foreign", function (object) {
  return defs.match(!defs.isGraceObject(object), object, Foreign);
});

exports.Foreign = Foreign;

exports.Done = defs.singleton("Done", defs.done);

Ordered = type("Ordered",
    [ defs.signature("compareTo", [ "value" ]),
      defs.signature("<", [ "than" ]),
      defs.signature("<=", [ "than" ]),
      defs.signature(">", [ "than" ]),
      defs.signature(">=", [ "than" ])
    ]);

exports.Ordered = Ordered;

Pattern = type("Pattern",
    [ defs.signature("match", [ "value" ]),
      defs.signature("assert", [ "value" ]),
      defs.signature("&", [ "and" ]),
      defs.signature("|", [ "or" ])
    ]);

exports.Pattern = Pattern;

exports.Action = type("Action", 1, [ defs.signature("apply") ]);

exports.Function =
  type("Function", 2, Pattern, [ defs.signature("apply", [ "value" ]) ]);

exports.Procedure =
  type("Procedure", 1, [ defs.signature("apply", [ "value" ]) ]);

(function () {
  var i, j, params;

  for (i = 2; i < 10; i += 1) {
    params = [ ];

    for (j = 1; j < i + 1; j += 1) {
      params.push("value" + j);
    }

    exports["Function" + i] =
      type("Function" + i, i + 1, [ defs.signature("apply", params) ]);

    exports["Procedure" + i] =
      type("Procedure" + i, i, [ defs.signature("apply", params) ]);
  }
}());

exports.Comparison = type("Comparison", Pattern,
    [ defs.signature("ifLessThan", [ "onLessThan" ]),
      defs.signature("ifEqualTo", [ "onEqualTo" ]),
      defs.signature("ifGreaterThan", [ "onGreaterThan" ]),
      defs.signature([ defs.sigPart("ifLessThan", [ "onLessThan" ]),
        defs.sigPart("ifEqualTo", [ "onEqualTo" ]) ]),
      defs.signature([ defs.sigPart("ifLessThan", [ "onLessThan" ]),
        defs.sigPart("ifGreaterThan", [ "onGreaterThan" ]) ]),
      defs.signature([ defs.sigPart("ifEqualTo", [ "onEqualTo" ]),
        defs.sigPart("ifGreaterThan", [ "onGreaterThan" ]) ]),
      defs.signature([ defs.sigPart("ifLessThan", [ "onLessThan" ]),
        defs.sigPart("ifEqualTo", [ "onEqualTo" ]),
        defs.sigPart("ifGreaterThan", [ "onGreaterThan" ]) ])
    ]);

Bool = type("Boolean",
    [ defs.signature([ defs.sigPart("ifTrue", [ "T" ], [ "then" ]),
        defs.sigPart("ifFalse", [ "E" ], [ "else" ]) ]),
      defs.signature("ifTrue", [ "then" ]),
      defs.signature("ifFalse", [ "else" ]),
      defs.signature([ defs.sigPart("andAlso", [ "then" ]),
        defs.sigPart("orElse", [ "else" ]) ]),
      defs.signature([ defs.sigPart("andAlso", [ "then" ]) ]),
      defs.signature([ defs.sigPart("orElse", [ "else" ]) ]),
      defs.signature("&&", [ "and" ]),
      defs.signature("||", [ "or" ]),
      defs.signature("prefix!")
    ]);

exports.Boolean = Bool;

exports.Match =
  type("Match", Bool, [ defs.signature("value"), defs.signature("pattern") ]);

exports.Number = type("Number", [ Ordered, Pattern ],
    [ defs.signature("prefix-"),
      defs.signature("+", [ "addene" ]),
      defs.signature("-", [ "subtrahend" ]),
      defs.signature("*", [ "multiplier" ]),
      defs.signature("/", [ "divisor" ]),
      defs.signature("%", [ "divisor" ]),
      defs.signature("^", [ "exponent" ]),
      defs.signature("absolute"),
      defs.signature("round"),
      defs.signature("floor"),
      defs.signature("ceiling"),
      defs.signature("log"),
      defs.signature("exponent"),
      defs.signature("sin"),
      defs.signature("cos"),
      defs.signature("tan"),
      defs.signature("asin"),
      defs.signature("acos"),
      defs.signature("atan"),
      defs.signature("square"),
      defs.signature("cube"),
      defs.signature("squareRoot"),
      defs.signature("asPrimitiveNumber")
    ]);

Do = type("Do", 1, [ defs.signature("do", [ "function" ]) ]);

exports.Do = Do;

Collection = type("Collection", 1, Do,
    [ defs.signature("size"),
      defs.signature([ defs.sigPart("fold", [ "T" ], [ "f" ]),
        defs.sigPart("startingWith", [ "a" ]) ])
    ]);

exports.Collection = Collection;

List = type("List", 1, Collection, [
  defs.signature("at", [ "index" ]),
  defs.signature("++", [ "list" ]),
  defs.signature("contains", [ "element" ]),
  defs.signature("asImmutable")
]);

exports.List = List;

exports.Entry = type("Entry", 2,
    [ defs.signature("key"),
      defs.signature("value")
    ]);

exports.String =
  type("String", [ Ordered, Pattern, List ],
      [ defs.signature([ defs.sigPart("substringFrom", [ "from" ]),
          defs.sigPart("to", [ "to" ]) ]),
        defs.signature([ defs.sigPart("substringFrom", [ "from" ]),
          defs.sigPart("size", [ "size" ]) ]),
        defs.signature("substringFrom", [ "from" ]),
        defs.signature("substringTo", [ "to" ]),
        defs.signature([ defs.sigPart("replace", [ "substring" ]),
          defs.sigPart("with", [ "inserting" ]) ]),
        defs.signature("startsWith", [ "prefix" ]),
        defs.signature("endsWith", [ "suffix" ]),
        defs.signature("indexOf", [ "needle" ]),
        defs.signature([ defs.sigPart("indexOf", [ "needle" ]),
          defs.sigPart("startingAt", [ "from" ]) ]),
        defs.signature([ defs.sigPart("indexOf", [ "needle" ]),
          defs.sigPart("ifAbsent", [ "action" ]) ]),
        defs.signature([ defs.sigPart("indexOf", [ "needle" ]),
          defs.sigPart("startingAt", [ "from" ]),
          defs.sigPart("ifAbsent", [ "action" ]) ]),
        defs.signature("lastIndexOf", [ "needle" ]),
        defs.signature([ defs.sigPart("lastIndexOf", [ "needle" ]),
          defs.sigPart("startingAt", [ "from" ]) ]),
        defs.signature([ defs.sigPart("lastIndexOf", [ "needle" ]),
          defs.sigPart("ifAbsent", [ "action" ]) ]),
        defs.signature([ defs.sigPart("lastIndexOf", [ "needle" ]),
          defs.sigPart("startingAt", [ "from" ]),
          defs.sigPart("ifAbsent", [ "action" ]) ]),
        defs.signature("asPrimitiveString")
      ]);

exports.ObjectAnnotator =
  type("ObjectAnnotator", [ defs.signature("annotateObject", [ "obj" ]) ]);

exports.MethodAnnotator =
  type("MethodAnnotator", [ defs.signature("annotateMethod", [ "meth" ]) ]);

exports.DefAnnotator =
  type("DefAnnotator", [ defs.signature("annotateDef", [ "definition" ]) ]);

exports.VarAnnotator = type("VarAnnotator",
  [ defs.signature("annotateVar", [ "reader", "writer" ]) ]);

exports.ClassAnnotator =
  type("ClassAnnotator", [ defs.signature("annotateClass", [ "cls" ]) ]);

exports.TypeAnnotator =
  type("TypeAnnotator", [ defs.signature("annotateType", [ "typ" ]) ]);

Node = defs.pattern("Node", function (value) {
  return defs.match(value instanceof ast.Node, value, this);
});

util.forProperties(ast, function (name, Ctor) {
  var pattern = defs.pattern(name, function (value) {
    return defs.match(value instanceof Ctor, value, this);
  });

  Node[name] = rt.method(name, 0, function () {
    return pattern;
  });
});

Node.visitor = rt.method("visitor", 0, function () {
  return visitor;
});

exports.Node = Node;

},{"../ast":1,"../ast/visitor":2,"../runtime":10,"../util":21,"./definitions":11}],19:[function(require,module,exports){
// A Promise-like implementation of asynchronous tasks. Tasks are compatible
// with Promise's 'thenable' definition, but are not compliant with the Promises
// specification.

"use strict";

var asap, timer, util;

require("setimmediate");

asap = require("asap");

util = require("./util");

timer = Date.now();

function DeferralError(message) {
  var error;

  if (message !== undefined) {
    this.message = message;
  }

  error = new TypeError(this.message);
  error.name = this.name;
  this.stack = error.stack;
}

util.inherits(DeferralError, TypeError);

DeferralError.prototype.name = "DeferralError";

DeferralError.prototype.message = "A purely asynchronous task cannot be forced";

function InterruptError(message) {
  var error;

  if (message !== undefined) {
    this.message = message;
  }

  error = new Error(this.message);
  error.name = this.name;
  this.stack = error.stack;
}

util.inherits(InterruptError, Error);

InterruptError.prototype.name = "InterruptError";

InterruptError.prototype.message = "A task was stopped before it completed";

// Pump the task dependency queue and remove both queues when done.
function pump(task, list, arg) {
  task.isPending = false;

  while (list.length > 0) {
    list.shift()(arg);
  }

  delete task.onFulfilled;
  delete task.onRejected;
}

// Handle passing the outcome of a task to the next.
function completion(task, fresh, next, passthrough, resolve, reject) {
  return function (result) {
    // Regardless of whether or not the fresh task still depended on the outcome
    // of the previous task, it can't be waiting on it any longer (because it's
    // finished). This property may be reinstated by the call to 'next' below,
    // as the fresh task can now depend on the result of one of the functions
    // passed to 'next' (or 'now').
    delete fresh.waitingOn;

    // Due to the presence of 'stop', the fresh task may have already completed
    // before the task it depended on did. In this case, don't perform the next
    // action.
    if (fresh.isPending) {
      if (typeof next === "function") {
        try {
          result = next.call(task.context, result);
        } catch (error) {
          reject(error);
          return;
        }

        resolve(result);
      } else {
        passthrough(result);
      }
    }
  };
}

// new Task(context : Object = null, func : (Object -> (), Error -> ()) -> ())
//   Build a new task, running the given function with a resolve and reject
//   callback, optionally in the given context.
function Task(context, func) {
  var self = this;

  if (arguments.length < 2) {
    func = context;
    context = null;
  }

  this.isPending = true;
  this.context = context;

  this.onFulfilled = [];
  this.onRejected = [];

  func.call(context, function (value) {
    if (self.isPending) {
      self.value = value;
      pump(self, self.onFulfilled, value);
    }
  }, function (reason) {
    if (self.isPending) {
      self.reason = reason;
      pump(self, self.onRejected, reason);
    }
  }, this);
}

function then(task, run) {
  return new Task(task.context, function (resolve, reject, fresh) {
    // A task can be waiting on one of two tasks: either it is waiting for a
    // value to be produced by the original task the 'then' method was called
    // on, or it is waiting for the task created by the function passed to
    // 'then'. In this case, it is waiting for the former. Note that the
    // original task may have already completed, in which case it will switch to
    // waiting on the latter.
    fresh.waitingOn = task;

    run.call(task, function (value, force) {
      if (value === fresh) {
        throw new TypeError("A task must not resolve to itself");
      }

      if (value instanceof Task) {
        if (value.isPending) {
          // The original task is done, and the function that ran as a result
          // has produced a new task, meaning the fresh task now depends on that
          // instead. Note that we cannot get here if the fresh task is stopped
          // before the original task completes.
          fresh.waitingOn = value;
          value[force ? "now" : "then"](resolve).then(null, reject);
        } else if (util.owns(value, "value")) {
          resolve(value.value);
        } else {
          reject(value.reason);
        }
      } else {
        resolve(value);
      }
    }, reject, fresh);
  });
}

Task.prototype.then = function (onFulfilled, onRejected) {
  return then(this, function (res, reject, fresh) {
    var deferred, self;

    self = this;

    deferred = util.once(function (force) {
      delete fresh.deferred;

      function resolve(value) {
        res(value, force);
      }

      function fulfiller() {
        return completion(self, fresh, onFulfilled, resolve, resolve, reject);
      }

      function rejecter() {
        return completion(self, fresh, onRejected, reject, resolve, reject);
      }

      if (force && util.owns(self, "deferred")) {
        self.deferred(force);
      }

      if (self.isPending) {
        self.onFulfilled.push(fulfiller());
        self.onRejected.push(rejecter());
      } else if (util.owns(self, "value")) {
        fulfiller()(self.value);
      } else {
        rejecter()(self.reason);
      }
    });

    fresh.deferred = deferred;

    if (Date.now() - timer > 10) {
      setImmediate(function () {
        timer = Date.now();
        deferred();
      });
    } else {
      asap(deferred);
    }
  });
};

// Execute the callbacks immediately if this task is complete. If this task is
// still pending, attempt to force the task to finish. If the task cannot be
// forced, then the resulting task is rejected with a DeferralError.
Task.prototype.now = function (onFulfilled, onRejected) {
  if (util.owns(this, "deferred")) {
    this.deferred(true);
  }

  if (this.isPending) {
    return Task.reject(new DeferralError());
  }

  return then(this, function (res, reject, fresh) {
    function resolve(value) {
      res(value, true);
    }

    if (util.owns(this, "value")) {
      completion(this,
        fresh, onFulfilled, resolve, resolve, reject)(this.value);
    } else {
      completion(this, fresh, onRejected, reject, resolve, reject)(this.reason);
    }
  });
};

Task.prototype.callback = function (callback) {
  return this.then(callback && function (value) {
    callback.call(this, null, value);
  }, callback);
};

Task.prototype.bind = function (context) {
  var task = this.then(util.id);
  task.context = context;
  return task;
};

// Halt the execution of this task and tasks it depends on. If the task has not
// already completed, called this method causes this task and its dependencies
// to be rejected with an InterruptError. This method does not guarantee an
// immediate stop, as tasks may yield outside of the internal task machinery,
// and their resumption may have side-effects before completing their
// surrounding task.
//
// Note that tasks that have been spawned by the task dependency chain that are
// not included in the dependency chain (ie concurrent executions) will not be
// stopped by this method. They must be managed separately.
Task.prototype.stop = function () {
  var dependency;

  if (!this.isPending) {
    // If the task is already completed, stopping has no effect.
    return;
  }

  // It's possible to be waiting on a task that isn't pending, when this task
  // is being synchronously stopped after the task it depends on has completed,
  // but before the asynchronous chaining can occur. If this is the case, we'll
  // pump now, setting this task to a completed state, and when the asynchronous
  // completion runs in the future the waitingOn dependency will be deleted but
  // no other action will be taken.
  if (this.waitingOn !== undefined && this.waitingOn.isPending) {
    // The rejection of this task will occur once the dependency chain is also
    // rejected.
    dependency = this.waitingOn;
    asap(function () {
      dependency.stop();
    });
  } else {
    this.reason = new InterruptError();
    pump(this, this.onRejected, this.reason);
  }
};

// A utility method to produce a function that will stop this task when called.
Task.prototype.stopify = function () {
  var self = this;

  return function () {
    return self.stop();
  };
};

Task.resolve = function (context, value) {
  if (arguments.length < 2) {
    value = context;
    context = null;
  }

  if (value instanceof Task) {
    return value;
  }

  return new Task(context, function (resolve) {
    resolve(value);
  });
};

Task.reject = function (context, reason) {
  if (arguments.length < 2) {
    reason = context;
    context = null;
  }

  return new Task(context, function (resolve, reject) {
    reject(reason);
  });
};

Task.never = function (context) {
  if (arguments.length < 1) {
    context = null;
  }

  return new Task(context, function () {
    return;
  });
};

// each(context : Object = null,
//     lists+ : [T], action : T+ -> Task<U>) -> Task<[U]>
//   Run an asynchronous action over lists of arguments in order, chaining each
//   non-undefined result of the action into a list. Multiple lists must have
//   matching lengths. The context must not be an array, otherwise it must be
//   bound manually.
Task.each = function (context, first) {
  var action, i, j, l, length, part, parts, results;

  function run(k, task) {
    if (k === length) {
      return task.then(function () {
        return results;
      });
    }

    return run(k + 1, task.then(function () {
      return action.apply(this, parts[k]);
    }).then(function (value) {
      if (value !== undefined) {
        results.push(value);
      }
    }));
  }

  if (util.isArray(context) ||
      typeof context === "number" || typeof context === "string") {
    first = context;
    context = null;
  } else {
    Array.prototype.shift.call(arguments);
  }

  results = [];
  parts = [];
  l = arguments.length - 1;
  action = arguments[l];

  if (typeof first === "number") {
    length = first;

    for (i = 0; i < length; i += 1) {
      parts.push([ i ]);
    }
  } else {
    length = first.length;

    for (i = 0; i < l; i += 1) {
      if (arguments[i].length !== length) {
        throw new TypeError("Mismatched list lengths");
      }
    }

    for (i = 0; i < length; i += 1) {
      part = [];

      for (j = 0; j < l; j += 1) {
        part.push(arguments[j][i]);
      }

      part.push(i);
      parts.push(part);
    }
  }

  // This is here to allow the list length check above to occur first.
  if (length === 0) {
    return Task.resolve(context, []);
  }

  return run(0, Task.resolve(context, null));
};

// Translate a function that may return a task into a function that takes a
// callback. If the function throws, the error is bundled into the callback.
// The resulting function returns another function which will call 'stop' on the
// underlying task.
Task.callbackify = function (func) {
  return function () {
    var args, callback, task;

    args = util.slice(arguments);
    callback = args.pop();

    try {
      task = func.apply(this, args);
    } catch (reason) {
      callback(reason);

      return function () {
        return false;
      };
    }

    return Task.resolve(task).callback(callback).stopify();
  };
};

// Translate a function that takes a callback into a function that returns a
// Task. If the function throws, the task automatically rejects.
Task.taskify = function (context, func) {
  if (arguments.length < 2) {
    func = context;
    context = null;
  }

  return function () {
    var args, self;

    self = this;
    args = util.slice(arguments);

    return new Task(context, function (resolve, reject) {
      args.push(function (reason, value) {
        if (reason !== null) {
          reject(reason);
        } else {
          resolve(value);
        }
      });

      try {
        func.apply(self, args);
      } catch (reason) {
        reject(reason);
      }
    });
  };
};

// An abstract constructor that includes helpers for maintaining the state of
// the 'this' context while performing task operations.
function Async() {
  return this;
}

// Resolve to a task with this object as the context.
Async.prototype.resolve = function (value) {
  return Task.resolve(this, value);
};

Async.prototype.reject = function (reason) {
  return Task.reject(this, reason);
};

Async.prototype.task = function (action) {
  return Task.resolve(this, null).then(function () {
    return action.call(this);
  });
};

Async.prototype.each = function () {
  return Task.each.apply(Task, [ this ].concat(util.slice(arguments)));
};

Task.DeferralError = DeferralError;
Task.InterruptError = InterruptError;
Task.Async = Async;

module.exports = Task;

},{"./util":21,"asap":22,"setimmediate":24}],20:[function(require,module,exports){
"use strict";
exports.isControl = function (c) {
  return /[\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u0380-\u0383\u038B\u038D\u03A2\u0530\u0557\u0558\u0560\u0588\u058B\u058C\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08B3-\u08E3\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0BFF\u0C04\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D00\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F9-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180E\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE\u1AAF\u1ABF-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7\u1CFA-\u1CFF\u1DF6-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BE-\u20CF\u20F1-\u20FF\u218A-\u218F\u23FB-\u23FF\u2427-\u243F\u244B-\u245F\u2B74\u2B75\u2B96\u2B97\u2BBA-\u2BBC\u2BC9\u2BD2-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E43-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA69E\uA6F8-\uA6FF\uA78F\uA7AE\uA7AF\uA7B2-\uA7F6\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB60-\uAB63\uAB66-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uD7FF\uDC00-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE2E\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDCFF\uDD03-\uDD06\uDD34-\uDD36\uDD8D-\uDD8F\uDD9C-\uDD9F\uDDA1-\uDDCF\uDDFE-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEDF\uDEFC-\uDEFF\uDF24-\uDF2F\uDF4B-\uDF4F\uDF7B-\uDF7F\uDF9E\uDFC4-\uDFC7\uDFD6-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCFF\uDD28-\uDD2F\uDD64-\uDD6E\uDD70-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56\uDC9F-\uDCA6\uDCB0-\uDCFF\uDD1C-\uDD1E\uDD3A-\uDD3E\uDD40-\uDD7F\uDDB8-\uDDBD\uDDC0-\uDDFF\uDE04\uDE07-\uDE0B\uDE14\uDE18\uDE34-\uDE37\uDE3B-\uDE3E\uDE48-\uDE4F\uDE59-\uDE5F\uDEA0-\uDEBF\uDEE7-\uDEEA\uDEF7-\uDEFF\uDF36-\uDF38\uDF56\uDF57\uDF73-\uDF77\uDF92-\uDF98\uDF9D-\uDFA8\uDFB0-\uDFFF]|\uD803[\uDC49-\uDE5F\uDE7F-\uDFFF]|\uD804[\uDC4E-\uDC51\uDC70-\uDC7E\uDCBD\uDCC2-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDCFF\uDD35\uDD44-\uDD4F\uDD77-\uDD7F\uDDC9-\uDDCC\uDDCE\uDDCF\uDDDB-\uDDE0\uDDF5-\uDDFF\uDE12\uDE3E-\uDEAF\uDEEB-\uDEEF\uDEFA-\uDF00\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A\uDF3B\uDF45\uDF46\uDF49\uDF4A\uDF4E-\uDF56\uDF58-\uDF5C\uDF64\uDF65\uDF6D-\uDF6F\uDF75-\uDFFF]|\uD805[\uDC00-\uDC7F\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDB6\uDDB7\uDDCA-\uDDFF\uDE45-\uDE4F\uDE5A-\uDE7F\uDEB8-\uDEBF\uDECA-\uDFFF]|\uD806[\uDC00-\uDC9F\uDCF3-\uDCFE\uDD00-\uDEBF\uDEF9-\uDFFF]|[\uD807\uD80A\uD80B\uD80E-\uD819\uD81C-\uD82B\uD82D\uD82E\uD830-\uD833\uD836-\uD839\uD83F\uD86F-\uD87D\uD87F-\uDB3F\uDB41-\uDBFF][\uDC00-\uDFFF]|\uD808[\uDF99-\uDFFF]|\uD809[\uDC6F\uDC75-\uDFFF]|\uD80D[\uDC2F-\uDFFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDE6D\uDE70-\uDECF\uDEEE\uDEEF\uDEF6-\uDEFF\uDF46-\uDF4F\uDF5A\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD81B[\uDC00-\uDEFF\uDF45-\uDF4F\uDF7F-\uDF8E\uDFA0-\uDFFF]|\uD82C[\uDC02-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A\uDC9B\uDCA0-\uDFFF]|\uD834[\uDCF6-\uDCFF\uDD27\uDD28\uDD73-\uDD7A\uDDDE-\uDDFF\uDE46-\uDEFF\uDF57-\uDF5F\uDF72-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDFCC\uDFCD]|\uD83A[\uDCC5\uDCC6\uDCD7-\uDFFF]|\uD83B[\uDC00-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDEEF\uDEF2-\uDFFF]|\uD83C[\uDC2C-\uDC2F\uDC94-\uDC9F\uDCAF\uDCB0\uDCC0\uDCD0\uDCF6-\uDCFF\uDD0D-\uDD0F\uDD2F\uDD6C-\uDD6F\uDD9B-\uDDE5\uDE03-\uDE0F\uDE3B-\uDE3F\uDE49-\uDE4F\uDE52-\uDEFF\uDF2D-\uDF2F\uDF7E\uDF7F\uDFCF-\uDFD3\uDFF8-\uDFFF]|\uD83D[\uDCFF\uDD4B-\uDD4F\uDD7A\uDDA4\uDE43\uDE44\uDED0-\uDEDF\uDEED-\uDEEF\uDEF4-\uDEFF\uDF74-\uDF7F\uDFD5-\uDFFF]|\uD83E[\uDC0C-\uDC0F\uDC48-\uDC4F\uDC5A-\uDC5F\uDC88-\uDC8F\uDCAE-\uDFFF]|\uD869[\uDED7-\uDEFF]|\uD86D[\uDF35-\uDF3F]|\uD86E[\uDC1E-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uDB40[\uDC00-\uDCFF\uDDF0-\uDFFF]|[\uD800-\uDBFF]/.test(c);
};
exports.isLetter = function (c) {
  return /[A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF40\uDF42-\uDF49\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF]|\uD801[\uDC00-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDE00-\uDE11\uDE13-\uDE2B\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF5D-\uDF61]|\uD805[\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDE00-\uDE2F\uDE44\uDE80-\uDEAA]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF98]|[\uD80C\uD840-\uD868\uD86A-\uD86C][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D]|\uD87E[\uDC00-\uDE1D]/.test(c);
};
exports.isNumber = function (c) {
  return /[0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]|\uD800[\uDD07-\uDD33\uDD40-\uDD78\uDD8A\uDD8B\uDEE1-\uDEFB\uDF20-\uDF23\uDF41\uDF4A\uDFD1-\uDFD5]|\uD801[\uDCA0-\uDCA9]|\uD802[\uDC58-\uDC5F\uDC79-\uDC7F\uDCA7-\uDCAF\uDD16-\uDD1B\uDE40-\uDE47\uDE7D\uDE7E\uDE9D-\uDE9F\uDEEB-\uDEEF\uDF58-\uDF5F\uDF78-\uDF7F\uDFA9-\uDFAF]|\uD803[\uDE60-\uDE7E]|\uD804[\uDC52-\uDC6F\uDCF0-\uDCF9\uDD36-\uDD3F\uDDD0-\uDDD9\uDDE1-\uDDF4\uDEF0-\uDEF9]|\uD805[\uDCD0-\uDCD9\uDE50-\uDE59\uDEC0-\uDEC9]|\uD806[\uDCE0-\uDCF2]|\uD809[\uDC00-\uDC6E]|\uD81A[\uDE60-\uDE69\uDF50-\uDF59\uDF5B-\uDF61]|\uD834[\uDF60-\uDF71]|\uD835[\uDFCE-\uDFFF]|\uD83A[\uDCC7-\uDCCF]|\uD83C[\uDD00-\uDD0C]/.test(c);
};
exports.isPunctuation = function (c) {
  return /[!-#%-\*,-/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDE38-\uDE3D]|\uD805[\uDCC6\uDDC1-\uDDC9\uDE41-\uDE43]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F/.test(c);
};
exports.isSeparator = function (c) {
  return /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/.test(c);
};
exports.isSymbol = function (c) {
  return /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20BD\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u2190-\u2307\u230C-\u2328\u232B-\u23FA\u2400-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B98-\u2BB9\u2BBD-\u2BC8\u2BCA-\u2BD1\u2CE5-\u2CEA\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFB\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u32FE\u3300-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uFB29\uFBB2-\uFBC1\uFDFC\uFDFD\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C\uDD90-\uDD9B\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDDD\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD83B[\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD10-\uDD2E\uDD30-\uDD6B\uDD70-\uDD9A\uDDE6-\uDE02\uDE10-\uDE3A\uDE40-\uDE48\uDE50\uDE51\uDF00-\uDF2C\uDF30-\uDF7D\uDF80-\uDFCE\uDFD4-\uDFF7]|\uD83D[\uDC00-\uDCFE\uDD00-\uDD4A\uDD50-\uDD79\uDD7B-\uDDA3\uDDA5-\uDE42\uDE45-\uDECF\uDEE0-\uDEEC\uDEF0-\uDEF3\uDF00-\uDF73\uDF80-\uDFD4]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD]/.test(c);
};

},{}],21:[function(require,module,exports){
// Common utility definitions.

"use strict";

var hasOwnProp, proto, slice, unicode;

unicode = require("./unicode");

proto = Object.prototype;

// Simple identity function.
exports.id = function (x) {
  return x;
};

slice = Array.prototype.slice;

// Standard not-quite-array slicer.
exports.slice = function (list, from, to) {
  return slice.call(list, from, to);
};

exports.contains = function (list, value) {
  var i, l;

  for (i = 0, l = list.length; i < l; i += 1) {
    if (list[i] === value) {
      return true;
    }
  }

  return false;
};

// Strip the parentheses from Grace method names.
exports.uglify = function (name) {
  return name.replace(/\(\)/g, "").replace(/ :=/, ":=").replace(/ /g, "_");
};

hasOwnProp = proto.hasOwnProperty;

// Ensures the correct hasOwnProperty is used.
function owns(object, name) {
  return hasOwnProp.call(object, name);
}

exports.owns = owns;

// Run a function for every iterable property directly in an object.
function forProperties(from, func) {
  var key;

  for (key in from) {
    if (owns(from, key)) {
      func(key, from[key]);
    }
  }
}

exports.forProperties = forProperties;

// Simple object key copier.
function extend(into, from) {
  var key;

  for (key in from) {
    if (owns(from, key) && !owns(into, key)) {
      into[key] = from[key];
    }
  }
}

exports.extend = extend;

exports.extendAll = function (into, from) {
  var key;

  for (key in from) {
    if (!owns(into, key)) {
      into[key] = from[key];
    }
  }
};

exports.map = function (list, func) {
  var i, l, newList;

  newList = [];

  for (i = 0, l = list.length; i < l; i += 1) {
    newList.push(func(list[i]));
  }

  return newList;
};

function pad(str) {
  while (str.length < 4) {
    str = "0" + str;
  }

  return str;
}

// Escape quotes, backslashes, and control characters in a string, making it
// safe to render inside quotes.
exports.escape = function (str) {
  var c, i, l, string;

  string = "";
  for (i = 0, l = str.length; i < l; i += 1) {
    c = str[i];

    if (unicode.isControl(c)) {
      string += "\\" + (c === "\b" ? "b" : c === "\n" ? "n" : c === "\r" ? "r" :
          c === "\t" ? "t" : c === "\f" ? "f" : c === "\v" ? "v" :
              c === "\u0000" ? "0" : "u" + pad(c.charCodeAt(0).toString(16)));
    } else if (c === '"') {
      string += '\\"';
    } else if (c === "\\") {
      string += "\\\\";
    } else {
      string += c;
    }
  }

  return string;
};

exports.newApply = function (Constructor, args) {
  function Temp() {
    Constructor.apply(this, args);
  }

  Temp.prototype = Constructor.prototype;

  return new Temp();
};

// Test if a value is an array.
exports.isArray = Array.isArray || function (value) {
  return proto.toString.call(value) === "[object Array]";
};

// Replicate a value in a list the given number of times.
exports.replicate = function (count, value) {
  var i, list;

  list = [];

  for (i = 0; i < count; i += 1) {
    list.push(value);
  }

  return list;
};

// Repeat the contents of a list the given number of times.
exports.repeat = function (count, elements) {
  var i, list;

  list = [];

  for (i = 0; i < count; i += 1) {
    list = list.concat(elements);
  }

  return list;
};

// A memoising function that also bans any recursion.
exports.once = function (func) {
  var hasFailed, hasFinished, isRunning, result;

  isRunning = false;
  hasFailed = false;
  hasFinished = false;

  return function () {
    if (hasFailed) {
      throw result;
    }

    if (hasFinished) {
      return result;
    }

    if (isRunning) {
      throw new Error("Memoised function called itself");
    }

    isRunning = true;

    try {
      result = func.apply(this, arguments);
    } catch (error) {
      hasFailed = true;
      result = error;
      throw error;
    } finally {
      isRunning = false;
    }

    hasFinished = true;
    return result;
  };
};

function makeCloneable(value) {
  var l, properties;

  properties = slice.call(arguments, 1);
  l = properties.length;

  function Clone() {
    makeCloneable.apply(null, [ this ].concat(properties));
  }

  Clone.prototype = value;

  value.clone = function () {
    var clone, i, property;

    clone = new Clone();

    for (i = 0; i < l; i += 1) {
      property = properties[i];
      clone[property] = this[property];
    }

    return clone;
  };
}

exports.makeCloneable = makeCloneable;

// Include the system utilities too.
extend(exports, require("util"));

},{"./unicode":20,"util":29}],22:[function(require,module,exports){
"use strict";

// rawAsap provides everything we need except exception management.
var rawAsap = require("./raw");
// RawTasks are recycled to reduce GC churn.
var freeTasks = [];
// We queue errors to ensure they are thrown in right order (FIFO).
// Array-as-queue is good enough here, since we are just dealing with exceptions.
var pendingErrors = [];
var requestErrorThrow = rawAsap.makeRequestCallFromTimer(throwFirstError);

function throwFirstError() {
    if (pendingErrors.length) {
        throw pendingErrors.shift();
    }
}

/**
 * Calls a task as soon as possible after returning, in its own event, with priority
 * over other events like animation, reflow, and repaint. An error thrown from an
 * event will not interrupt, nor even substantially slow down the processing of
 * other events, but will be rather postponed to a lower priority event.
 * @param {{call}} task A callable object, typically a function that takes no
 * arguments.
 */
module.exports = asap;
function asap(task) {
    var rawTask;
    if (freeTasks.length) {
        rawTask = freeTasks.pop();
    } else {
        rawTask = new RawTask();
    }
    rawTask.task = task;
    rawAsap(rawTask);
}

// We wrap tasks with recyclable task objects.  A task object implements
// `call`, just like a function.
function RawTask() {
    this.task = null;
}

// The sole purpose of wrapping the task is to catch the exception and recycle
// the task object after its single use.
RawTask.prototype.call = function () {
    try {
        this.task.call();
    } catch (error) {
        if (asap.onerror) {
            // This hook exists purely for testing purposes.
            // Its name will be periodically randomized to break any code that
            // depends on its existence.
            asap.onerror(error);
        } else {
            // In a web browser, exceptions are not fatal. However, to avoid
            // slowing down the queue of pending tasks, we rethrow the error in a
            // lower priority turn.
            pendingErrors.push(error);
            requestErrorThrow();
        }
    } finally {
        this.task = null;
        freeTasks[freeTasks.length] = this;
    }
};

},{"./raw":23}],23:[function(require,module,exports){
(function (global){
"use strict";

// Use the fastest means possible to execute a task in its own turn, with
// priority over other events including IO, animation, reflow, and redraw
// events in browsers.
//
// An exception thrown by a task will permanently interrupt the processing of
// subsequent tasks. The higher level `asap` function ensures that if an
// exception is thrown by a task, that the task queue will continue flushing as
// soon as possible, but if you use `rawAsap` directly, you are responsible to
// either ensure that no exceptions are thrown from your task, or to manually
// call `rawAsap.requestFlush` if an exception is thrown.
module.exports = rawAsap;
function rawAsap(task) {
    if (!queue.length) {
        requestFlush();
        flushing = true;
    }
    // Equivalent to push, but avoids a function call.
    queue[queue.length] = task;
}

var queue = [];
// Once a flush has been requested, no further calls to `requestFlush` are
// necessary until the next `flush` completes.
var flushing = false;
// `requestFlush` is an implementation-specific method that attempts to kick
// off a `flush` event as quickly as possible. `flush` will attempt to exhaust
// the event queue before yielding to the browser's own event loop.
var requestFlush;
// The position of the next task to execute in the task queue. This is
// preserved between calls to `flush` so that it can be resumed if
// a task throws an exception.
var index = 0;
// If a task schedules additional tasks recursively, the task queue can grow
// unbounded. To prevent memory exhaustion, the task queue will periodically
// truncate already-completed tasks.
var capacity = 1024;

// The flush function processes all tasks that have been scheduled with
// `rawAsap` unless and until one of those tasks throws an exception.
// If a task throws an exception, `flush` ensures that its state will remain
// consistent and will resume where it left off when called again.
// However, `flush` does not make any arrangements to be called again if an
// exception is thrown.
function flush() {
    while (index < queue.length) {
        var currentIndex = index;
        // Advance the index before calling the task. This ensures that we will
        // begin flushing on the next task the task throws an error.
        index = index + 1;
        queue[currentIndex].call();
        // Prevent leaking memory for long chains of recursive calls to `asap`.
        // If we call `asap` within tasks scheduled by `asap`, the queue will
        // grow, but to avoid an O(n) walk for every task we execute, we don't
        // shift tasks off the queue after they have been executed.
        // Instead, we periodically shift 1024 tasks off the queue.
        if (index > capacity) {
            // Manually shift all values starting at the index back to the
            // beginning of the queue.
            for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                queue[scan] = queue[scan + index];
            }
            queue.length -= index;
            index = 0;
        }
    }
    queue.length = 0;
    index = 0;
    flushing = false;
}

// `requestFlush` is implemented using a strategy based on data collected from
// every available SauceLabs Selenium web driver worker at time of writing.
// https://docs.google.com/spreadsheets/d/1mG-5UYGup5qxGdEMWkhP6BWCz053NUb2E1QoUTU16uA/edit#gid=783724593

// Safari 6 and 6.1 for desktop, iPad, and iPhone are the only browsers that
// have WebKitMutationObserver but not un-prefixed MutationObserver.
// Must use `global` instead of `window` to work in both frames and web
// workers. `global` is a provision of Browserify, Mr, Mrs, or Mop.
var BrowserMutationObserver = global.MutationObserver || global.WebKitMutationObserver;

// MutationObservers are desirable because they have high priority and work
// reliably everywhere they are implemented.
// They are implemented in all modern browsers.
//
// - Android 4-4.3
// - Chrome 26-34
// - Firefox 14-29
// - Internet Explorer 11
// - iPad Safari 6-7.1
// - iPhone Safari 7-7.1
// - Safari 6-7
if (typeof BrowserMutationObserver === "function") {
    requestFlush = makeRequestCallFromMutationObserver(flush);

// MessageChannels are desirable because they give direct access to the HTML
// task queue, are implemented in Internet Explorer 10, Safari 5.0-1, and Opera
// 11-12, and in web workers in many engines.
// Although message channels yield to any queued rendering and IO tasks, they
// would be better than imposing the 4ms delay of timers.
// However, they do not work reliably in Internet Explorer or Safari.

// Internet Explorer 10 is the only browser that has setImmediate but does
// not have MutationObservers.
// Although setImmediate yields to the browser's renderer, it would be
// preferrable to falling back to setTimeout since it does not have
// the minimum 4ms penalty.
// Unfortunately there appears to be a bug in Internet Explorer 10 Mobile (and
// Desktop to a lesser extent) that renders both setImmediate and
// MessageChannel useless for the purposes of ASAP.
// https://github.com/kriskowal/q/issues/396

// Timers are implemented universally.
// We fall back to timers in workers in most engines, and in foreground
// contexts in the following browsers.
// However, note that even this simple case requires nuances to operate in a
// broad spectrum of browsers.
//
// - Firefox 3-13
// - Internet Explorer 6-9
// - iPad Safari 4.3
// - Lynx 2.8.7
} else {
    requestFlush = makeRequestCallFromTimer(flush);
}

// `requestFlush` requests that the high priority event queue be flushed as
// soon as possible.
// This is useful to prevent an error thrown in a task from stalling the event
// queue if the exception handled by Node.js’s
// `process.on("uncaughtException")` or by a domain.
rawAsap.requestFlush = requestFlush;

// To request a high priority event, we induce a mutation observer by toggling
// the text of a text node between "1" and "-1".
function makeRequestCallFromMutationObserver(callback) {
    var toggle = 1;
    var observer = new BrowserMutationObserver(callback);
    var node = document.createTextNode("");
    observer.observe(node, {characterData: true});
    return function requestCall() {
        toggle = -toggle;
        node.data = toggle;
    };
}

// The message channel technique was discovered by Malte Ubl and was the
// original foundation for this library.
// http://www.nonblocking.io/2011/06/windownexttick.html

// Safari 6.0.5 (at least) intermittently fails to create message ports on a
// page's first load. Thankfully, this version of Safari supports
// MutationObservers, so we don't need to fall back in that case.

// function makeRequestCallFromMessageChannel(callback) {
//     var channel = new MessageChannel();
//     channel.port1.onmessage = callback;
//     return function requestCall() {
//         channel.port2.postMessage(0);
//     };
// }

// For reasons explained above, we are also unable to use `setImmediate`
// under any circumstances.
// Even if we were, there is another bug in Internet Explorer 10.
// It is not sufficient to assign `setImmediate` to `requestFlush` because
// `setImmediate` must be called *by name* and therefore must be wrapped in a
// closure.
// Never forget.

// function makeRequestCallFromSetImmediate(callback) {
//     return function requestCall() {
//         setImmediate(callback);
//     };
// }

// Safari 6.0 has a problem where timers will get lost while the user is
// scrolling. This problem does not impact ASAP because Safari 6.0 supports
// mutation observers, so that implementation is used instead.
// However, if we ever elect to use timers in Safari, the prevalent work-around
// is to add a scroll event listener that calls for a flush.

// `setTimeout` does not call the passed callback if the delay is less than
// approximately 7 in web workers in Firefox 8 through 18, and sometimes not
// even then.

function makeRequestCallFromTimer(callback) {
    return function requestCall() {
        // We dispatch a timeout with a specified delay of 0 for engines that
        // can reliably accommodate that request. This will usually be snapped
        // to a 4 milisecond delay, but once we're flushing, there's no delay
        // between events.
        var timeoutHandle = setTimeout(handleTimer, 0);
        // However, since this timer gets frequently dropped in Firefox
        // workers, we enlist an interval handle that will try to fire
        // an event 20 times per second until it succeeds.
        var intervalHandle = setInterval(handleTimer, 50);

        function handleTimer() {
            // Whichever timer succeeds will cancel both timers and
            // execute the callback.
            clearTimeout(timeoutHandle);
            clearInterval(intervalHandle);
            callback();
        }
    };
}

// This is for `asap.js` only.
// Its name will be periodically randomized to break any code that depends on
// its existence.
rawAsap.makeRequestCallFromTimer = makeRequestCallFromTimer;

// ASAP was originally a nextTick shim included in Q. This was factored out
// into this ASAP package. It was later adapted to RSVP which made further
// amendments. These decisions, particularly to marginalize MessageChannel and
// to capture the MutationObserver implementation in a closure, were integrated
// back into ASAP proper.
// https://github.com/tildeio/rsvp.js/blob/cddf7232546a9cf858524b75cde6f9edf72620a7/lib/rsvp/asap.js

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],24:[function(require,module,exports){
(function (process){
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var setImmediate;

    function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
        return nextHandle++;
    }

    // This function accepts the same arguments as setImmediate, but
    // returns a function that requires no arguments.
    function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1);
        return function() {
            if (typeof handler === "function") {
                handler.apply(undefined, args);
            } else {
                (new Function("" + handler))();
            }
        };
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    task();
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function installNextTickImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            process.nextTick(partiallyApplied(runIfPresent, handle));
            return handle;
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            global.postMessage(messagePrefix + handle, "*");
            return handle;
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            channel.port2.postMessage(handle);
            return handle;
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
            return handle;
        };
    }

    function installSetTimeoutImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
            return handle;
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(new Function("return this")()));

}).call(this,require('_process'))
},{"_process":27}],25:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],26:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":27}],27:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],28:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],29:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":28,"_process":27,"inherits":25}],30:[function(require,module,exports){
(function (global){
global.hopper = require(".")
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{".":3}]},{},[30]);
