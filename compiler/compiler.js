// ============================================================================
// LEXER (Lexical Analyzer)
// ============================================================================

console.log('compiler.js loaded');

class Token {
    constructor(type, value, line, column) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
    }
}

class Lexer {
    constructor(source) {
        this.source = source;
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
        this.errors = [];

        this.keywords = new Set([
            'int','float','string','bool','char','void',
            'if','else','while','for','return','print',
            'true','false','function','break','continue','input'
        ]);
    }

    currentChar() { return this.position < this.source.length ? this.source[this.position] : null; }
    peek(offset = 1) { const p = this.position + offset; return p < this.source.length ? this.source[p] : null; }

    advance() {
        if (this.currentChar() === '\n') { this.line++; this.column = 1; } else { this.column++; }
        this.position++;
    }

    skipWhitespace() {
        while (this.currentChar() && /\s/.test(this.currentChar())) this.advance();
    }

    // ── LINE COMMENT ──────────────────────────────────────────────────────────
    skipLineComment() {
        while (this.currentChar() && this.currentChar() !== '\n') this.advance();
    }

    // ── BLOCK COMMENT (supports nested  /* /* */ */) ──────────────────────────
    skipBlockComment() {
        const startLine = this.line, startCol = this.column;
        let depth = 0;
        while (this.currentChar()) {
            if (this.currentChar() === '/' && this.peek() === '*') {
                this.advance(); this.advance(); depth++;
            } else if (this.currentChar() === '*' && this.peek() === '/') {
                this.advance(); this.advance(); depth--;
                if (depth === 0) return;
            } else { this.advance(); }
        }
        this.errors.push({ type:'Lexical Error', message:`Unterminated block comment opened at ${startLine}:${startCol}`, line:startLine, column:startCol });
    }

    // ── NUMBER ────────────────────────────────────────────────────────────────
    readNumber() {
        let num = '', hasDecimal = false;
        const sl = this.line, sc = this.column;

        // Hex literal  0x…
        if (this.currentChar() === '0' && (this.peek() === 'x' || this.peek() === 'X')) {
            num += this.currentChar(); this.advance();
            num += this.currentChar(); this.advance();
            while (this.currentChar() && /[0-9a-fA-F_]/.test(this.currentChar())) {
                if (this.currentChar() !== '_') num += this.currentChar();
                this.advance();
            }
            return new Token('INT_LITERAL', num, sl, sc);
        }

        while (this.currentChar() && (/\d/.test(this.currentChar()) || this.currentChar() === '.' || this.currentChar() === '_')) {
            if (this.currentChar() === '_') { this.advance(); continue; }
            if (this.currentChar() === '.') {
                if (hasDecimal) { this.errors.push({ type:'Lexical Error', message:'Invalid number: multiple decimal points', line:this.line, column:this.column }); break; }
                hasDecimal = true;
            }
            num += this.currentChar(); this.advance();
        }
        // Scientific notation
        if (this.currentChar() && this.currentChar().toLowerCase() === 'e') {
            hasDecimal = true; num += this.currentChar(); this.advance();
            if (this.currentChar() === '+' || this.currentChar() === '-') { num += this.currentChar(); this.advance(); }
            while (this.currentChar() && /\d/.test(this.currentChar())) { num += this.currentChar(); this.advance(); }
        }
        return new Token(hasDecimal ? 'FLOAT_LITERAL' : 'INT_LITERAL', num, sl, sc);
    }

    // ── IDENTIFIER / KEYWORD ──────────────────────────────────────────────────
    readIdentifier() {
        let id = '';
        const sl = this.line, sc = this.column;
        while (this.currentChar() && /[a-zA-Z0-9_]/.test(this.currentChar())) { id += this.currentChar(); this.advance(); }
        let type = this.keywords.has(id) ? 'KEYWORD' : 'IDENTIFIER';
        // Give boolean literals their own types so the parser can distinguish
        if (id === 'true')  type = 'BOOL_TRUE';
        if (id === 'false') type = 'BOOL_FALSE';
        return new Token(type, id, sl, sc);
    }

    // ── STRING ────────────────────────────────────────────────────────────────
    readString() {
        let str = '';
        const sl = this.line, sc = this.column;
        const quote = this.currentChar();
        this.advance(); // skip opening quote
        const escMap = { n:'\n', t:'\t', r:'\r', '\\':'\\', '"':'"', "'":"'", '0':'\0' };
        while (this.currentChar() && this.currentChar() !== quote) {
            if (this.currentChar() === '\n') { this.errors.push({ type:'Lexical Error', message:'Unterminated string literal', line:sl, column:sc }); break; }
            if (this.currentChar() === '\\') {
                this.advance();
                str += (escMap[this.currentChar()] ?? ('\\' + this.currentChar()));
                this.advance();
            } else { str += this.currentChar(); this.advance(); }
        }
        if (this.currentChar() === quote) this.advance(); else this.errors.push({ type:'Lexical Error', message:'Unterminated string literal', line:sl, column:sc });
        return new Token('STRING_LITERAL', str, sl, sc);
    }

    // ── REGEX LITERAL   /pattern/flags ────────────────────────────────────────
    readRegex(sl, sc) {
        let pattern = '';
        while (this.currentChar() && this.currentChar() !== '/') {
            if (this.currentChar() === '\\') { pattern += this.currentChar(); this.advance(); }
            pattern += this.currentChar(); this.advance();
        }
        if (this.currentChar() === '/') this.advance();
        let flags = '';
        while (this.currentChar() && /[gimsuy]/.test(this.currentChar())) { flags += this.currentChar(); this.advance(); }
        return new Token('REGEX_LITERAL', `/${pattern}/${flags}`, sl, sc);
    }

    // ── OPERATORS (all multi-char variants) ───────────────────────────────────
    readOperator() {
        const sl = this.line, sc = this.column;
        const ch = this.currentChar(); this.advance();
        const nx = this.currentChar();

        // Three-character operators first (rare but safe to check)
        // Two-character operators
        const two = ch + (nx || '');
        const twoCharOps = ['==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','%=','**','->','<<','>>'];
        if (twoCharOps.includes(two)) { this.advance(); return new Token('OPERATOR', two, sl, sc); }

        return new Token('OPERATOR', ch, sl, sc);
    }

    // ── MAIN TOKENIZE LOOP ────────────────────────────────────────────────────
    tokenize() {
        while (this.position < this.source.length) {
            this.skipWhitespace();
            if (!this.currentChar()) break;

            const ch = this.currentChar();
            const sl = this.line, sc = this.column;

            // Comments
            if (ch === '/' && this.peek() === '/') { this.advance(); this.advance(); this.skipLineComment(); continue; }
            if (ch === '/' && this.peek() === '*') { this.skipBlockComment(); continue; }

            // Regex literal — only after operator/keyword context (simplified: after '=' or start)
            if (ch === '/' && this.tokens.length > 0) {
                const last = this.tokens[this.tokens.length - 1];
                const afterOp = ['OPERATOR','KEYWORD','PUNCTUATION'].includes(last.type);
                if (afterOp) { this.advance(); this.tokens.push(this.readRegex(sl, sc)); continue; }
            }

            if (/\d/.test(ch))           { this.tokens.push(this.readNumber()); continue; }
            if (/[a-zA-Z_]/.test(ch))    { this.tokens.push(this.readIdentifier()); continue; }
            if (ch === '"' || ch === "'") { this.tokens.push(this.readString()); continue; }

            if ('+-*/<>=!&|%^~'.includes(ch)) { this.tokens.push(this.readOperator()); continue; }

            if ('(){}[];,.:'.includes(ch)) {
                this.tokens.push(new Token('PUNCTUATION', ch, sl, sc));
                this.advance(); continue;
            }

            this.errors.push({ type:'Lexical Error', message:`Unknown character: '${ch}'`, line:sl, column:sc });
            this.advance();
        }
        return { tokens: this.tokens, errors: this.errors };
    }
}

// ============================================================================
// PARSER (Syntax Analyzer)
// ============================================================================

class ASTNode {
    constructor(type, value = null) {
        this.type = type;
        this.value = value;
        this.children = [];
    }

    addChild(node) {
        this.children.push(node);
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.position = 0;
        this.errors = [];
    }

    currentToken() {
        return this.position < this.tokens.length ? this.tokens[this.position] : null;
    }

    peek(offset = 1) {
        const pos = this.position + offset;
        return pos < this.tokens.length ? this.tokens[pos] : null;
    }

    advance() {
        this.position++;
    }

    expect(type, value = null) {
        const token = this.currentToken();
        if (!token) {
            this.errors.push({
                type: 'Syntax Error',
                message: `Expected ${value || type} but reached end of input`,
                line: 0,
                column: 0
            });
            return false;
        }

        if (token.type !== type || (value && token.value !== value)) {
            this.errors.push({
                type: 'Syntax Error',
                message: `Expected ${value || type} but got ${token.value}`,
                line: token.line,
                column: token.column
            });
            return false;
        }

        this.advance();
        return true;
    }

    parse() {
        const root = new ASTNode('Program');

        while (this.currentToken()) {
            const stmt = this.parseStatement();
            if (stmt) {
                root.addChild(stmt);
            }
        }

        return { ast: root, errors: this.errors };
    }

    parseStatement() {
        const token = this.currentToken();
        if (!token) return null;

        // Variable declaration
        if (token.type === 'KEYWORD' && ['int', 'float', 'string', 'bool'].includes(token.value)) {
            return this.parseDeclaration();
        }
        // If statement
        else if (token.type === 'KEYWORD' && token.value === 'if') {
            return this.parseIfStatement();
        }
        // While loop
        else if (token.type === 'KEYWORD' && token.value === 'while') {
            return this.parseWhileStatement();
        }
        // For loop
        else if (token.type === 'KEYWORD' && token.value === 'for') {
            return this.parseForStatement();
        }
        // Print statement
        else if (token.type === 'KEYWORD' && token.value === 'print') {
            return this.parsePrintStatement();
        }
        // Return statement
        else if (token.type === 'KEYWORD' && token.value === 'return') {
            return this.parseReturnStatement();
        }
        // Assignment or expression
        else if (token.type === 'IDENTIFIER') {
            return this.parseAssignment();
        }
        // Skip unexpected tokens
        else {
            this.errors.push({
                type: 'Syntax Error',
                message: `Unexpected token: ${token.value}`,
                line: token.line,
                column: token.column
            });
            this.advance();
            return null;
        }
    }

    parseDeclaration() {
        const node = new ASTNode('Declaration');
        const typeToken = this.currentToken();
        node.addChild(new ASTNode('Type', typeToken.value));
        this.advance();

        if (!this.expect('IDENTIFIER')) return node;
        const idToken = this.tokens[this.position - 1];
        node.addChild(new ASTNode('Identifier', idToken.value));

        // Check for initialization
        if (this.currentToken() && this.currentToken().value === '=') {
            this.advance();
            const expr = this.parseExpression();
            if (expr) {
                node.addChild(expr);
            }
        }

        this.expect('PUNCTUATION', ';');
        return node;
    }

    parseAssignment() {
        const node = new ASTNode('Assignment');
        const idToken = this.currentToken();
        node.addChild(new ASTNode('Identifier', idToken.value));
        this.advance();

        if (!this.expect('OPERATOR', '=')) return node;

        const expr = this.parseExpression();
        if (expr) {
            node.addChild(expr);
        }

        this.expect('PUNCTUATION', ';');
        return node;
    }

    parseIfStatement() {
        const node = new ASTNode('IfStatement');
        this.advance(); // Skip 'if'

        this.expect('PUNCTUATION', '(');
        const condition = this.parseExpression();
        if (condition) {
            node.addChild(condition);
        }
        this.expect('PUNCTUATION', ')');

        this.expect('PUNCTUATION', '{');
        const body = new ASTNode('Body');
        while (this.currentToken() && this.currentToken().value !== '}') {
            const stmt = this.parseStatement();
            if (stmt) body.addChild(stmt);
        }
        node.addChild(body);
        this.expect('PUNCTUATION', '}');

        return node;
    }

    parseWhileStatement() {
        const node = new ASTNode('WhileStatement');
        this.advance(); // Skip 'while'

        this.expect('PUNCTUATION', '(');
        const condition = this.parseExpression();
        if (condition) {
            node.addChild(condition);
        }
        this.expect('PUNCTUATION', ')');

        this.expect('PUNCTUATION', '{');
        const body = new ASTNode('Body');
        while (this.currentToken() && this.currentToken().value !== '}') {
            const stmt = this.parseStatement();
            if (stmt) body.addChild(stmt);
        }
        node.addChild(body);
        this.expect('PUNCTUATION', '}');

        return node;
    }

    parsePrintStatement() {
        const node = new ASTNode('PrintStatement');
        this.advance(); // Skip 'print'

        this.expect('PUNCTUATION', '(');
        const expr = this.parseExpression();
        if (expr) {
            node.addChild(expr);
        }
        this.expect('PUNCTUATION', ')');
        this.expect('PUNCTUATION', ';');

        return node;
    }

    parseForStatement() {
        const node = new ASTNode('ForStatement');
        this.advance(); // Skip 'for'

        this.expect('PUNCTUATION', '(');
        
        // Initialization
        const init = this.parseStatement();
        if (init) node.addChild(init);
        
        // Condition
        const condition = this.parseExpression();
        if (condition) node.addChild(condition);
        this.expect('PUNCTUATION', ';');
        
        // Increment
        const increment = this.parseAssignmentExpression();
        if (increment) node.addChild(increment);
        
        this.expect('PUNCTUATION', ')');

        this.expect('PUNCTUATION', '{');
        const body = new ASTNode('Body');
        while (this.currentToken() && this.currentToken().value !== '}') {
            const stmt = this.parseStatement();
            if (stmt) body.addChild(stmt);
        }
        node.addChild(body);
        this.expect('PUNCTUATION', '}');

        return node;
    }

    parseReturnStatement() {
        const node = new ASTNode('ReturnStatement');
        this.advance(); // Skip 'return'

        // Check if there's an expression to return
        if (this.currentToken() && this.currentToken().value !== ';') {
            const expr = this.parseExpression();
            if (expr) {
                node.addChild(expr);
            }
        }

        this.expect('PUNCTUATION', ';');
        return node;
    }

    parseAssignmentExpression() {
        if (this.currentToken() && this.currentToken().type === 'IDENTIFIER') {
            const node = new ASTNode('Assignment');
            const idToken = this.currentToken();
            node.addChild(new ASTNode('Identifier', idToken.value));
            this.advance();

            if (this.currentToken() && this.currentToken().value === '=') {
                this.advance();
                const expr = this.parseExpression();
                if (expr) {
                    node.addChild(expr);
                }
            }
            return node;
        }
        return null;
    }

    parseExpression() {
        return this.parseComparison();
    }

    parseComparison() {
        let left = this.parseTerm();

        while (this.currentToken() && 
               this.currentToken().type === 'OPERATOR' &&
               ['==', '!=', '<', '>', '<=', '>='].includes(this.currentToken().value)) {
            const op = this.currentToken().value;
            this.advance();
            const right = this.parseTerm();
            
            const node = new ASTNode('BinaryOp', op);
            node.addChild(left);
            node.addChild(right);
            left = node;
        }

        return left;
    }

    parseTerm() {
        let left = this.parseFactor();

        while (this.currentToken() && 
               this.currentToken().type === 'OPERATOR' &&
               ['+', '-'].includes(this.currentToken().value)) {
            const op = this.currentToken().value;
            this.advance();
            const right = this.parseFactor();
            
            const node = new ASTNode('BinaryOp', op);
            node.addChild(left);
            node.addChild(right);
            left = node;
        }

        return left;
    }

    parseFactor() {
        let left = this.parsePrimary();

        while (this.currentToken() && 
               this.currentToken().type === 'OPERATOR' &&
               ['*', '/'].includes(this.currentToken().value)) {
            const op = this.currentToken().value;
            this.advance();
            const right = this.parsePrimary();
            
            const node = new ASTNode('BinaryOp', op);
            node.addChild(left);
            node.addChild(right);
            left = node;
        }

        return left;
    }

    parsePrimary() {
        const token = this.currentToken();
        if (!token) return null;

        if (token.type === 'INT_LITERAL' || token.type === 'FLOAT_LITERAL') {
            this.advance();
            return new ASTNode('Literal', token.value);
        }
        else if (token.type === 'STRING_LITERAL') {
            this.advance();
            return new ASTNode('StringLiteral', token.value);
        }
        else if (token.type === 'KEYWORD' && (token.value === 'true' || token.value === 'false')) {
            this.advance();
            return new ASTNode('BooleanLiteral', token.value);
        }
        else if (token.type === 'IDENTIFIER') {
            this.advance();
            return new ASTNode('Identifier', token.value);
        }
        else if (token.type === 'PUNCTUATION' && token.value === '(') {
            this.advance();
            const expr = this.parseExpression();
            this.expect('PUNCTUATION', ')');
            return expr;
        }

        this.errors.push({
            type: 'Syntax Error',
            message: `Unexpected token in expression: ${token.value}`,
            line: token.line,
            column: token.column
        });
        this.advance();
        return null;
    }
}

// ============================================================================
// BOTTOM-UP PARSER (Shift-Reduce with operator-precedence table)
// ============================================================================

class ShiftReduceParser {
    constructor(tokens) {
        this.tokens = tokens.filter(t => t.type !== 'EOF'); // strip EOF for table
        this.tokens.push(new Token('EOF', '$', 0, 0));
        this.pos     = 0;
        this.stack   = [];          // parse stack  [{state, node}]
        this.output  = [];          // reduction log (shown in UI)
        this.errors  = [];

        // Precedence table: higher number = higher precedence
        this.precedence = {
            '||': 1, '&&': 2,
            '==': 3, '!=': 3,
            '<': 4, '>': 4, '<=': 4, '>=': 4,
            '+': 5, '-': 5,
            '*': 6, '/': 6, '%': 6,
            '**': 7,   // right-assoc power
            'UNARY': 8
        };
        this.rightAssoc = new Set(['**']);
    }

    currentToken() { return this.tokens[this.pos] || new Token('EOF','$',0,0); }

    advance() { if (this.pos < this.tokens.length - 1) this.pos++; }

    prec(op) { return this.precedence[op] ?? 0; }

    // Simple operator-precedence shift-reduce for expressions
    parseExpression(minPrec = 0) {
        let left = this.parsePrimary();

        while (true) {
            const tok = this.currentToken();
            if (tok.type !== 'OPERATOR') break;
            const p = this.prec(tok.value);
            if (p <= minPrec) break;

            const op = tok.value; this.advance();
            const nextPrec = this.rightAssoc.has(op) ? p - 1 : p;
            const right = this.parseExpression(nextPrec);

            const node = new ASTNode('BinaryOp', op);
            node.addChild(left); node.addChild(right);
            this.output.push(`REDUCE: ${left.value ?? left.type}  ${op}  ${right.value ?? right.type}  →  BinaryOp`);
            left = node;
        }
        return left;
    }

    parsePrimary() {
        const tok = this.currentToken();

        if (tok.type === 'INT_LITERAL' || tok.type === 'FLOAT_LITERAL') {
            this.advance(); this.output.push(`SHIFT: ${tok.value} (${tok.type})`);
            return new ASTNode('Literal', tok.value);
        }
        if (tok.type === 'STRING_LITERAL') {
            this.advance(); this.output.push(`SHIFT: "${tok.value}" (STRING)`);
            return new ASTNode('StringLiteral', tok.value);
        }
        if (tok.type === 'BOOL_TRUE' || tok.type === 'BOOL_FALSE') {
            this.advance(); this.output.push(`SHIFT: ${tok.value} (BOOL)`);
            return new ASTNode('BooleanLiteral', tok.value);
        }
        if (tok.type === 'IDENTIFIER') {
            this.advance(); this.output.push(`SHIFT: ${tok.value} (ID)`);
            // Function call?
            if (this.currentToken().value === '(') {
                this.advance(); // (
                const callNode = new ASTNode('FunctionCall', tok.value);
                while (this.currentToken().value !== ')' && this.currentToken().type !== 'EOF') {
                    callNode.addChild(this.parseExpression());
                    if (this.currentToken().value === ',') this.advance();
                }
                if (this.currentToken().value === ')') this.advance();
                this.output.push(`REDUCE: call ${tok.value}(...)  →  FunctionCall`);
                return callNode;
            }
            return new ASTNode('Identifier', tok.value);
        }
        if (tok.value === '(') {
            this.advance(); this.output.push(`SHIFT: (`);
            const expr = this.parseExpression();
            if (this.currentToken().value === ')') { this.advance(); this.output.push(`SHIFT: )`); }
            return expr;
        }
        // Unary minus / not
        if (tok.value === '-' || tok.value === '!') {
            this.advance(); this.output.push(`SHIFT: ${tok.value} (UNARY)`);
            const operand = this.parseExpression(this.prec('UNARY'));
            const node = new ASTNode('UnaryOp', tok.value); node.addChild(operand);
            this.output.push(`REDUCE: ${tok.value}${operand.value ?? operand.type}  →  UnaryOp`);
            return node;
        }

        // Error — skip unknown token
        this.errors.push({ type:'Syntax Error (SR)', message:`Unexpected token in expression: '${tok.value}'`, line:tok.line, column:tok.column });
        this.advance();
        return new ASTNode('Error', tok.value);
    }

    parseStatement() {
        const tok = this.currentToken();
        if (!tok || tok.type === 'EOF') return null;

        // Variable declaration
        if (tok.type === 'KEYWORD' && ['int','float','string','bool','char','void'].includes(tok.value)) {
            const node = new ASTNode('Declaration');
            node.addChild(new ASTNode('Type', tok.value)); this.advance();
            if (this.currentToken().type === 'IDENTIFIER') {
                const id = this.currentToken(); this.advance();
                node.addChild(new ASTNode('Identifier', id.value));
                if (this.currentToken().value === '=') {
                    this.advance(); node.addChild(this.parseExpression());
                }
            }
            if (this.currentToken().value === ';') this.advance();
            this.output.push(`REDUCE: Declaration`);
            return node;
        }

        // If
        if (tok.value === 'if') {
            this.advance();
            const node = new ASTNode('IfStatement');
            if (this.currentToken().value === '(') this.advance();
            node.addChild(this.parseExpression());
            if (this.currentToken().value === ')') this.advance();
            node.addChild(this.parseBlock());
            if (this.currentToken().value === 'else') { this.advance(); node.addChild(this.parseBlock()); }
            this.output.push(`REDUCE: IfStatement`);
            return node;
        }

        // While
        if (tok.value === 'while') {
            this.advance();
            const node = new ASTNode('WhileStatement');
            if (this.currentToken().value === '(') this.advance();
            node.addChild(this.parseExpression());
            if (this.currentToken().value === ')') this.advance();
            node.addChild(this.parseBlock());
            this.output.push(`REDUCE: WhileStatement`);
            return node;
        }

        // For
        if (tok.value === 'for') {
            this.advance();
            const node = new ASTNode('ForStatement');
            if (this.currentToken().value === '(') this.advance();
            node.addChild(this.parseStatement()); // init
            node.addChild(this.parseExpression()); // condition
            if (this.currentToken().value === ';') this.advance();
            // update
            if (this.currentToken().type === 'IDENTIFIER') {
                const upd = new ASTNode('Assignment');
                upd.addChild(new ASTNode('Identifier', this.currentToken().value)); this.advance();
                if (this.currentToken().value === '=') this.advance();
                upd.addChild(this.parseExpression());
                node.addChild(upd);
            }
            if (this.currentToken().value === ')') this.advance();
            node.addChild(this.parseBlock());
            this.output.push(`REDUCE: ForStatement`);
            return node;
        }

        // Return
        if (tok.value === 'return') {
            this.advance();
            const node = new ASTNode('ReturnStatement');
            if (this.currentToken().value !== ';') node.addChild(this.parseExpression());
            if (this.currentToken().value === ';') this.advance();
            this.output.push(`REDUCE: ReturnStatement`);
            return node;
        }

        // Print
        if (tok.value === 'print') {
            this.advance();
            const node = new ASTNode('PrintStatement');
            if (this.currentToken().value === '(') this.advance();
            node.addChild(this.parseExpression());
            if (this.currentToken().value === ')') this.advance();
            if (this.currentToken().value === ';') this.advance();
            this.output.push(`REDUCE: PrintStatement`);
            return node;
        }

        // Assignment or expression-statement
        if (tok.type === 'IDENTIFIER') {
            // Peek if next is '='
            if (this.tokens[this.pos + 1]?.value === '=') {
                const node = new ASTNode('Assignment');
                node.addChild(new ASTNode('Identifier', tok.value)); this.advance(); this.advance(); // id =
                node.addChild(this.parseExpression());
                if (this.currentToken().value === ';') this.advance();
                this.output.push(`REDUCE: Assignment`);
                return node;
            }
            // compound assignment
            const compoundOps = ['+=','-=','*=','/=','%='];
            if (compoundOps.includes(this.tokens[this.pos + 1]?.value)) {
                const node = new ASTNode('CompoundAssignment', this.tokens[this.pos + 1].value);
                node.addChild(new ASTNode('Identifier', tok.value)); this.advance(); this.advance();
                node.addChild(this.parseExpression());
                if (this.currentToken().value === ';') this.advance();
                this.output.push(`REDUCE: CompoundAssignment`);
                return node;
            }
            // expression statement
            const expr = this.parseExpression();
            if (this.currentToken().value === ';') this.advance();
            return expr;
        }

        // Panic-mode error recovery: skip to next ';' or '}'
        this.errors.push({ type:'Syntax Error (SR)', message:`Unexpected token: '${tok.value}' — skipping to next statement`, line:tok.line, column:tok.column });
        while (this.currentToken().value !== ';' && this.currentToken().value !== '}' && this.currentToken().type !== 'EOF') this.advance();
        if (this.currentToken().value === ';') this.advance();
        return null;
    }

    parseBlock() {
        const node = new ASTNode('Body');
        if (this.currentToken().value === '{') this.advance();
        while (this.currentToken().value !== '}' && this.currentToken().type !== 'EOF') {
            const s = this.parseStatement(); if (s) node.addChild(s);
        }
        if (this.currentToken().value === '}') this.advance();
        return node;
    }

    parse() {
        const root = new ASTNode('Program');
        while (this.currentToken().type !== 'EOF') {
            const stmt = this.parseStatement();
            if (stmt) root.addChild(stmt);
        }
        return { ast: root, reductions: this.output, errors: this.errors };
    }
}
// ============================================================================
// SEMANTIC ANALYZER
// ============================================================================

class SemanticAnalyzer {
    constructor(ast) {
        this.ast        = ast;
        this.scopeStack = [new Map()];   // stack of Maps — index 0 = global
        this.errors     = [];
        this.warnings   = [];
        this.allScopes  = [];            // saved for display
        this.currentFunctionReturn = null;
    }

    // ── Scope helpers ─────────────────────────────────────────────────────────
    get currentScope() { return this.scopeStack[this.scopeStack.length - 1]; }
    pushScope()  { this.scopeStack.push(new Map()); }
    popScope()   { this.allScopes.push(this.scopeStack.pop()); }

    // Look up the nearest scope that has this name
    lookup(name) {
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            if (this.scopeStack[i].has(name)) return this.scopeStack[i].get(name);
        }
        return null;
    }

    declareVar(name, type, line, col, initialized) {
        if (this.currentScope.has(name)) {
            this.errors.push({ type:'Semantic Error', message:`Variable '${name}' already declared in this scope`, line, column:col });
        } else {
            this.currentScope.set(name, { type, initialized, used:false, line, scope: this.scopeStack.length - 1 });
        }
    }

    // ── Type helpers ──────────────────────────────────────────────────────────
    literalType(node) {
        if (node.type === 'Literal')        return /\./.test(node.value) ? 'float' : 'int';
        if (node.type === 'StringLiteral')  return 'string';
        if (node.type === 'BooleanLiteral') return 'bool';
        if (node.type === 'Identifier')     return this.lookup(node.value)?.type ?? 'unknown';
        if (node.type === 'BinaryOp')       return this.resolveBinaryType(node);
        return 'unknown';
    }

    resolveBinaryType(node) {
        const lt = this.literalType(node.children[0]);
        const rt = this.literalType(node.children[1]);
        const compOps = ['==','!=','<','>','<=','>=','&&','||'];
        if (compOps.includes(node.value)) return 'bool';
        if (lt === 'float' || rt === 'float') return 'float';
        if (lt === 'string' && node.value === '+') return 'string';   // string concat
        if (lt === 'string' || rt === 'string') {
            this.errors.push({ type:'Semantic Error', message:`Type mismatch: cannot use '${node.value}' between '${lt}' and '${rt}'`, line:0, column:0 });
            return 'error';
        }
        return lt; // both int
    }

    typeCompatible(declared, actual) {
        if (declared === actual) return true;
        if (declared === 'float' && actual === 'int') return true;  // widening allowed
        if (declared === 'unknown' || actual === 'unknown') return true;
        return false;
    }

    // ── Main visitor ──────────────────────────────────────────────────────────
    analyze() {
        this.visit(this.ast);
        // Warn about unused variables in global scope
        this.scopeStack[0].forEach((info, name) => {
            if (!info.used) this.warnings.push({ type:'Semantic Warning', message:`Variable '${name}' declared but never used`, line:info.line, column:0 });
        });
        this.allScopes.push(this.scopeStack[0]);
        return { symbolTable: this.buildFlatTable(), scopeStack: this.allScopes, errors: this.errors, warnings: this.warnings };
    }

    buildFlatTable() {
        const flat = new Map();
        this.allScopes.forEach((scope, si) => {
            scope.forEach((info, name) => {
                flat.set(`${name} (scope ${info.scope})`, info);
            });
        });
        // Also include current scope (in case no pops happened)
        this.currentScope.forEach((info, name) => {
            if (!flat.has(`${name} (scope ${info.scope})`)) flat.set(`${name} (scope ${info.scope})`, info);
        });
        return flat;
    }

    visit(node) {
        if (!node) return;
        switch (node.type) {
            case 'Program':
                node.children.forEach(c => this.visit(c)); break;
            case 'Declaration':      this.visitDeclaration(node); break;
            case 'Assignment':       this.visitAssignment(node); break;
            case 'CompoundAssignment': this.visitAssignment(node); break;
            case 'IfStatement':      this.visitBlock(node); break;
            case 'WhileStatement':   this.visitBlock(node); break;
            case 'ForStatement':     this.visitBlock(node); break;
            case 'PrintStatement':
            case 'ReturnStatement':  node.children.forEach(c => this.visit(c)); break;
            case 'BinaryOp':         this.visitBinaryOp(node); break;
            case 'UnaryOp':          this.visit(node.children[0]); break;
            case 'Identifier':       this.visitIdentifier(node); break;
            case 'FunctionCall':     node.children.forEach(c => this.visit(c)); break;
            case 'Body':             node.children.forEach(c => this.visit(c)); break;
            default: if (node.children) node.children.forEach(c => this.visit(c));
        }
    }

    visitBlock(node) {
        this.pushScope();
        node.children.forEach(c => this.visit(c));
        this.popScope();
    }

    visitDeclaration(node) {
        const type = node.children[0].value;
        const name = node.children[1].value;
        const hasInit = node.children.length > 2;
        this.declareVar(name, type, 0, 0, hasInit);
        if (hasInit) {
            const initNode = node.children[2];
            this.visit(initNode);
            const actualType = this.literalType(initNode);
            if (!this.typeCompatible(type, actualType) && actualType !== 'unknown') {
                this.errors.push({ type:'Semantic Error', message:`Type mismatch: cannot assign '${actualType}' to '${type}' variable '${name}'`, line:0, column:0 });
            }
        }
    }

    visitAssignment(node) {
        const name = node.children[0].value;
        const sym  = this.lookup(name);
        if (!sym) {
            this.errors.push({ type:'Semantic Error', message:`Variable '${name}' used before declaration`, line:0, column:0 });
        } else {
            sym.initialized = true;
            const valNode = node.children[1];
            this.visit(valNode);
            const actualType = this.literalType(valNode);
            if (!this.typeCompatible(sym.type, actualType) && actualType !== 'unknown') {
                this.errors.push({ type:'Semantic Error', message:`Type mismatch: cannot assign '${actualType}' to '${sym.type}' variable '${name}'`, line:0, column:0 });
            }
        }
        if (node.children[1]) this.visit(node.children[1]);
    }

    visitBinaryOp(node) {
        this.visit(node.children[0]);
        this.visit(node.children[1]);
        this.resolveBinaryType(node); // triggers error if types incompatible
    }

    visitIdentifier(node) {
        const sym = this.lookup(node.value);
        if (!sym) {
            this.errors.push({ type:'Semantic Error', message:`Variable '${node.value}' not declared`, line:0, column:0 });
        } else {
            sym.used = true;
            if (!sym.initialized) this.warnings.push({ type:'Semantic Warning', message:`Variable '${node.value}' used before initialization`, line:0, column:0 });
        }
    }
}

// ============================================================================
// IR GENERATOR — Three-Address Code (3AC) / Quadruples
// ============================================================================

class IRGenerator {
    constructor(ast) {
        this.ast      = ast;
        this.code     = [];       // list of 3AC instruction strings
        this.quads    = [];       // list of {op, arg1, arg2, result}
        this.tempCount = 0;
        this.labelCount = 0;
    }

    newTemp()  { return `t${++this.tempCount}`; }
    newLabel() { return `L${++this.labelCount}`; }

    emit(op, arg1 = '', arg2 = '', result = '') {
        this.quads.push({ op, arg1, arg2, result });
        if (op === 'label') {
            this.code.push(`${result}:`);
        } else if (op === 'goto') {
            this.code.push(`    goto ${result}`);
        } else if (op === 'if_false') {
            this.code.push(`    if_false ${arg1} goto ${result}`);
        } else if (op === 'param') {
            this.code.push(`    param ${arg1}`);
        } else if (op === 'call') {
            this.code.push(`    ${result} = call ${arg1}, ${arg2}`);
        } else if (op === 'print') {
            this.code.push(`    print ${arg1}`);
        } else if (op === 'return') {
            this.code.push(`    return ${arg1}`);
        } else if (arg2) {
            this.code.push(`    ${result} = ${arg1} ${op} ${arg2}`);
        } else if (arg1) {
            this.code.push(`    ${result} = ${arg1}`);
        }
    }

    generate() {
        this.code.push('; === Three-Address Code (3AC) ===');
        this.visitNode(this.ast);
        return { code: this.code, quads: this.quads };
    }

    visitNode(node) {
        if (!node) return null;
        switch (node.type) {
            case 'Program':
                node.children.forEach(c => this.visitNode(c)); return null;
            case 'Declaration':      return this.genDeclaration(node);
            case 'Assignment':
            case 'CompoundAssignment': return this.genAssignment(node);
            case 'IfStatement':      return this.genIf(node);
            case 'WhileStatement':   return this.genWhile(node);
            case 'ForStatement':     return this.genFor(node);
            case 'PrintStatement':   return this.genPrint(node);
            case 'ReturnStatement':  return this.genReturn(node);
            case 'BinaryOp':         return this.genBinaryOp(node);
            case 'UnaryOp':          return this.genUnaryOp(node);
            case 'FunctionCall':     return this.genCall(node);
            case 'Identifier':       return node.value;
            case 'Literal':          return node.value;
            case 'StringLiteral':    return `"${node.value}"`;
            case 'BooleanLiteral':   return node.value;
            case 'Body':
                node.children.forEach(c => this.visitNode(c)); return null;
            default:
                if (node.children) node.children.forEach(c => this.visitNode(c));
                return null;
        }
    }

    genDeclaration(node) {
        const name = node.children[1].value;
        if (node.children.length > 2) {
            const val = this.visitNode(node.children[2]);
            this.emit('=', val, '', name);
        }
        return name;
    }

    genAssignment(node) {
        const name = node.children[0].value;
        const val  = this.visitNode(node.children[1]);
        if (node.type === 'CompoundAssignment') {
            const baseOp = node.value.replace('=',''); // +=  →  +
            const t = this.newTemp();
            this.emit(baseOp, name, val, t);
            this.emit('=', t, '', name);
        } else {
            this.emit('=', val, '', name);
        }
        return name;
    }

    genBinaryOp(node) {
        // Constant folding optimisation
        const lNode = node.children[0], rNode = node.children[1];
        if (lNode.type === 'Literal' && rNode.type === 'Literal') {
            const l = parseFloat(lNode.value), r = parseFloat(rNode.value);
            const ops = { '+': l+r, '-': l-r, '*': l*r, '/': r !== 0 ? l/r : 'DIV0', '%': l%r };
            if (ops[node.value] !== undefined) {
                this.code.push(`    ; [constant folded] ${l} ${node.value} ${r} = ${ops[node.value]}`);
                return String(ops[node.value]);
            }
        }
        const left  = this.visitNode(lNode);
        const right = this.visitNode(rNode);
        const t = this.newTemp();
        this.emit(node.value, left, right, t);
        return t;
    }

    genUnaryOp(node) {
        const operand = this.visitNode(node.children[0]);
        const t = this.newTemp();
        this.emit(`UNARY${node.value}`, operand, '', t);
        return t;
    }

    genIf(node) {
        const cond     = this.visitNode(node.children[0]);
        const labelElse = this.newLabel();
        const labelEnd  = this.newLabel();
        this.emit('if_false', cond, '', labelElse);
        this.visitNode(node.children[1]);       // then body
        this.emit('goto', '', '', labelEnd);
        this.emit('label', '', '', labelElse);
        if (node.children[2]) this.visitNode(node.children[2]);  // else body
        this.emit('label', '', '', labelEnd);
        return null;
    }

    genWhile(node) {
        const labelStart = this.newLabel();
        const labelEnd   = this.newLabel();
        this.emit('label', '', '', labelStart);
        const cond = this.visitNode(node.children[0]);
        this.emit('if_false', cond, '', labelEnd);
        this.visitNode(node.children[1]);
        this.emit('goto', '', '', labelStart);
        this.emit('label', '', '', labelEnd);
        return null;
    }

    genFor(node) {
        // init
        if (node.children[0]) this.visitNode(node.children[0]);
        const labelStart = this.newLabel(), labelEnd = this.newLabel();
        this.emit('label', '', '', labelStart);
        if (node.children[1]) { const cond = this.visitNode(node.children[1]); this.emit('if_false', cond, '', labelEnd); }
        this.visitNode(node.children[3]);   // body
        if (node.children[2]) this.visitNode(node.children[2]); // update
        this.emit('goto', '', '', labelStart);
        this.emit('label', '', '', labelEnd);
        return null;
    }

    genPrint(node) {
        const val = this.visitNode(node.children[0]);
        this.emit('print', val, '', '');
        return null;
    }

    genReturn(node) {
        const val = node.children.length ? this.visitNode(node.children[0]) : '';
        this.emit('return', val, '', '');
        return null;
    }

    genCall(node) {
        node.children.forEach(arg => {
            const v = this.visitNode(arg);
            this.emit('param', v, '', '');
        });
        const t = this.newTemp();
        this.emit('call', node.value, node.children.length, t);
        return t;
    }
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function displayTokens(tokens) {
    const output = document.getElementById('lexerOutput');
    if (!output) return;
    
    let html = '<div style="margin-bottom:10px;padding:8px;background:#E7E9EB;border-radius:6px;">';
    html += `<strong>Total Tokens: ${tokens.length}</strong> — Each token represents a lexical unit from the source code.`;
    html += '</div>';
    
    html += '<table class="symbol-table" style="font-size:12px;"><tr><th>Type</th><th>Value</th><th>Line</th><th>Column</th></tr>';
    tokens.forEach(token => {
        let bgColor = '#ffffff';
        if (token.type === 'KEYWORD') bgColor = '#FFF4A3';
        else if (token.type === 'IDENTIFIER') bgColor = '#E7E9EB';
        else if (token.type === 'INT_LITERAL' || token.type === 'FLOAT_LITERAL') bgColor = '#FFE6E6';
        else if (token.type === 'STRING_LITERAL') bgColor = '#CCE5FF';
        else if (['PLUS', 'MINUS', 'MULTIPLY', 'DIVIDE', 'EQUAL', 'EQUAL_EQUAL', 'NOT_EQUAL', 'LESS', 'GREATER', 'LESS_EQUAL', 'GREATER_EQUAL'].includes(token.type)) bgColor = '#D4EDDA';
        else if (['LPAREN', 'RPAREN', 'LBRACE', 'RBRACE', 'SEMICOLON', 'COMMA'].includes(token.type)) bgColor = '#F8F9FA';
        
        html += `<tr style="background:${bgColor};">`;
        html += `<td><strong>${token.type}</strong></td>`;
        html += `<td><code>${escapeHtml(token.value)}</code></td>`;
        html += `<td>${token.line}</td>`;
        html += `<td>${token.column}</td>`;
        html += '</tr>';
    });
    html += '</table>';
    output.innerHTML = html;
}

function compile() {
    const source = document.getElementById('sourceCode').value;
    if (!source.trim()) { alert('Please enter some code to compile!'); return; }

    // Clear all outputs
    ['lexerOutput','parserOutput','parserOutputSR','symbolTableOutput',
     'errorsOutput','irOutput','optimizationsOutput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    let allErrors = [], allWarnings = [];

    // ── PHASE 1: LEXER ────────────────────────────────────────────────────────
    const lexer = new Lexer(source);
    const { tokens, errors: lexerErrors } = lexer.tokenize();
    allErrors = allErrors.concat(lexerErrors);
    displayTokens(tokens);

    // ── PHASE 2a: TOP-DOWN RECURSIVE DESCENT PARSER ───────────────────────────
    const parser = new Parser(tokens);
    const { ast, errors: parserErrors } = parser.parse();
    allErrors = allErrors.concat(parserErrors);
    displayAST(ast, 'parserOutput', '🔽 Top-Down (Recursive Descent)');

    // ── PHASE 2b: BOTTOM-UP SHIFT-REDUCE PARSER ───────────────────────────────
    const srParser = new ShiftReduceParser(tokens.slice());
    const { ast: srAst, reductions, errors: srErrors } = srParser.parse();
    allErrors = allErrors.concat(srErrors);
    displayAST(srAst, 'parserOutputSR', '🔼 Bottom-Up (Shift-Reduce)');
    displayReductions(reductions);

    // ── PHASE 3: SEMANTIC ANALYSIS ────────────────────────────────────────────
    const analyzer = new SemanticAnalyzer(ast);
    const { symbolTable, errors: semanticErrors, warnings } = analyzer.analyze();
    allErrors  = allErrors.concat(semanticErrors);
    allWarnings = allWarnings.concat(warnings);
    displaySymbolTable(symbolTable);

    // ── PHASE 4: IR GENERATION ────────────────────────────────────────────────
    const irGen = new IRGenerator(ast);
    const { code: irCode, quads } = irGen.generate();
    displayIR(irCode, quads);

    // ── CODE OPTIMIZER ────────────────────────────────────────────────────────
    const optimizer = new CodeOptimizer(ast);
    const optimizations = optimizer.optimize();
    displayOptimizations(optimizations);

    displayErrors(allErrors, allWarnings);
    updateStats(tokens, source, allErrors, symbolTable);
    showNotification('✓ Compilation Complete — All 4 Phases Done!');
}

// ── Display IR ────────────────────────────────────────────────────────────────
function displayIR(codeLines, quads) {
    const out = document.getElementById('irOutput');
    if (!out) return;

    let html = '<p style="margin:5px 0;color:#666;font-size:14px;">Intermediate Representation (3AC - Three Address Code) is a low-level code format that makes optimization and code generation easier. Each instruction has at most three operands.</p>';
    html += '<div style="margin-bottom:10px;padding:8px;background:#E7E9EB;border-radius:6px;">';
    html += `<strong>3AC Instructions: ${codeLines.length}</strong> &nbsp;|&nbsp; <strong>Quads: ${quads.length}</strong></div>`;
    html += '<pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">';
    html += codeLines.map(l => {
        if (l.endsWith(':')) return `<span style="color:#fbbf24">${escapeHtml(l)}</span>`;
        if (l.trim().startsWith(';'))  return `<span style="color:#64748b">${escapeHtml(l)}</span>`;
        return escapeHtml(l);
    }).join('\n');
    html += '</pre>';

    // Quadruple table
    html += '<br><strong>Quadruples Table:</strong>';
    html += '<table class="symbol-table" style="margin-top:8px;font-size:12px;"><tr><th>#</th><th>Op</th><th>Arg1</th><th>Arg2</th><th>Result</th></tr>';
    quads.forEach((q, i) => {
        html += `<tr><td>${i+1}</td><td><code>${escapeHtml(q.op)}</code></td><td>${escapeHtml(String(q.arg1))}</td><td>${escapeHtml(String(q.arg2))}</td><td><strong>${escapeHtml(String(q.result))}</strong></td></tr>`;
    });
    html += '</table>';
    out.innerHTML = html;
}


// ── Display shift-reduce reductions log ───────────────────────────────────────
function displayReductions(reductions) {
    const out = document.getElementById('srReductionsOutput');
    if (!out) return;
    let html = '<p style="margin:5px 0;color:#666;font-size:14px;">The shift-reduce parser processes tokens step-by-step: <strong>SHIFT</strong> adds tokens to the stack, <strong>REDUCE</strong> applies grammar rules to reduce stack elements.</p>';
    html += '<pre style="background:#0f172a;color:#94a3b8;padding:10px;border-radius:6px;font-size:11px;overflow:auto;max-height:300px;">';
    reductions.forEach((r, i) => {
        const color = r.startsWith('REDUCE') ? '#86efac' : r.startsWith('SHIFT') ? '#7dd3fc' : '#fbbf24';
        html += `<span style="color:${color}">${i+1}. ${escapeHtml(r)}</span>\n`;
    });
    html += '</pre>';
    out.innerHTML = html;
}

// ── Updated displayAST to target a specific element ───────────────────────────
function displayAST(ast, targetId = 'parserOutput', label = '') {
    const output = document.getElementById(targetId);
    if (!output) return;
    const stats = calculateASTStats(ast);
    let html = '';
    if (label) {
        let description = '';
        if (label.includes('Top-Down')) {
            description = '<p style="margin:5px 0;color:#666;font-size:14px;">This parser uses <strong>recursive descent</strong> to build the AST from the token stream. It starts from the root grammar rule and recursively expands non-terminals until all tokens are consumed.</p>';
        } else if (label.includes('Bottom-Up')) {
            description = '<p style="margin:5px 0;color:#666;font-size:14px;">This parser uses <strong>shift-reduce</strong> to build the AST. It shifts tokens onto a stack and reduces them according to grammar rules, working from leaves to root.</p>';
        }
        html += `<div style="font-weight:700;color:#04AA6D;margin-bottom:8px;">${label}</div>${description}`;
    }
    html += '<div style="margin-bottom: 15px; padding: 10px; background: #E7E9EB; border-radius: 6px;">';
    html += `<strong>AST Statistics:</strong> &nbsp; Nodes: <strong>${stats.totalNodes}</strong> &nbsp;|&nbsp; Depth: <strong>${stats.maxDepth}</strong> &nbsp;|&nbsp; Statements: <strong>${stats.statements}</strong>`;
    html += '</div>';
    html += '<div style="font-family:monospace;font-size:13px;background:#f8f9fa;padding:10px;border-radius:6px;border:1px solid #dee2e6;overflow-x:auto;white-space:pre-wrap;word-wrap:break-word;">' + renderAST(ast, 0, '', true) + '</div>';
    output.innerHTML = html;
}


function calculateASTStats(node, depth = 0) {
    if (!node) return { totalNodes: 0, maxDepth: 0, statements: 0 };
    
    let stats = {
        totalNodes: 1,
        maxDepth: depth,
        statements: ['Declaration', 'Assignment', 'IfStatement', 'WhileStatement', 'ForStatement', 'PrintStatement', 'ReturnStatement'].includes(node.type) ? 1 : 0
    };
    
    if (node.children) {
        node.children.forEach(child => {
            const childStats = calculateASTStats(child, depth + 1);
            stats.totalNodes += childStats.totalNodes;
            stats.maxDepth = Math.max(stats.maxDepth, childStats.maxDepth);
            stats.statements += childStats.statements;
        });
    }
    
    return stats;
}

function renderAST(node, indent = 0, prefix = '', isLast = true) {
    if (!node) return '';
    
    let html = '';
    
    // Color code different node types
    let nodeColor = '#000000';
    if (['Declaration', 'Assignment'].includes(node.type)) nodeColor = '#04AA6D';
    else if (['IfStatement', 'WhileStatement', 'ForStatement'].includes(node.type)) nodeColor = '#2563EB';
    else if (['BinaryOp', 'UnaryOp'].includes(node.type)) nodeColor = '#F57C00';
    else if (['Identifier', 'Literal'].includes(node.type)) nodeColor = '#7B1FA2';
    else if (node.type === 'Block') nodeColor = '#607D8B';
    
    // Build the tree character line
    const nodePrefix = indent === 0 ? '' : (isLast ? '└── ' : '├── ');
    const continuationPrefix = indent === 0 ? '' : (isLast ? '    ' : '│   ');
    
    html += prefix;
    html += `<span style="color: ${nodeColor}; font-weight: bold;">${nodePrefix}${node.type}</span>`;
    
    if (node.value !== undefined) {
        let valueColor = '#D32F2F';
        if (typeof node.value === 'string' && node.value.match(/^\d+$/)) valueColor = '#388E3C';
        else if (typeof node.value === 'string' && node.value.match(/^\d+\.\d+$/)) valueColor = '#1976D2';
        html += `: <span style="background: #FFF4A3; padding: 2px 6px; border-radius: 3px; color: ${valueColor};">${escapeHtml(String(node.value))}</span>`;
    }
    
    html += '<br>';
    
    if (node.children && node.children.length > 0) {
        node.children.forEach((child, index) => {
            const isLastChild = index === node.children.length - 1;
            const newPrefix = continuationPrefix;
            html += renderAST(child, indent + 1, newPrefix, isLastChild);
        });
    }
    
    return html;
}

function displaySymbolTable(symbolTable) {
    const output = document.getElementById('symbolTableOutput');
    
    if (symbolTable.size === 0) {
        output.innerHTML = '<div class="warning">No symbols in table</div>';
        return;
    }

    let html = '<p style="margin:5px 0;color:#666;font-size:14px;">The symbol table tracks all variables, their types, and usage. It helps detect undeclared variables, type mismatches, and unused code.</p>';

    // Calculate statistics
    let unusedVars = 0;
    let uninitializedVars = 0;
    
    symbolTable.forEach((info) => {
        if (!info.used) unusedVars++;
        if (!info.initialized) uninitializedVars++;
    });

    // Display statistics
    html += '<div style="margin-bottom: 15px; padding: 10px; background: #E7E9EB; border-radius: 6px;">';
    html += '<strong>Symbol Table Statistics:</strong><br>';
    html += `<span style="margin-right: 15px;">Total Variables: <strong>${symbolTable.size}</strong></span>`;
    html += `<span style="margin-right: 15px;">Unused: <strong style="color: #F57C00;">${unusedVars}</strong></span>`;
    html += `<span>Uninitialized: <strong style="color: #F57C00;">${uninitializedVars}</strong></span>`;
    html += '</div>';

    html += '<table class="symbol-table">';
    html += '<tr><th>Name</th><th>Type</th><th>Initialized</th><th>Used</th></tr>';
    
    symbolTable.forEach((info, name) => {
        const unusedStyle = !info.used ? 'background: #FFFFCC;' : '';
        html += `<tr style="${unusedStyle}">
            <td><code>${escapeHtml(name)}</code></td>
            <td>${info.type}</td>
            <td>${info.initialized ? '✅' : '❌'}</td>
            <td>${info.used ? '✅' : '❌'}</td>
        </tr>`;
    });
    
    html += '</table>';
    output.innerHTML = html;
}

function displayErrors(errors, warnings) {
    const output = document.getElementById('errorsOutput');
    
    if (errors.length === 0 && warnings.length === 0) {
        output.innerHTML = '<div class="success">✅ No errors or warnings!</div>';
        return;
    }

    let html = '';
    
    errors.forEach(error => {
        html += `<div class="error">
            <strong>${error.type}</strong>: ${error.message}
            ${error.line ? ` (Line ${error.line}, Col ${error.column})` : ''}
        </div>`;
    });

    warnings.forEach(warning => {
        html += `<div class="warning">
            <strong>${warning.type}</strong>: ${warning.message}
            ${warning.line ? ` (Line ${warning.line}, Col ${warning.column})` : ''}
        </div>`;
    });

    output.innerHTML = html;
}

function updateStats(tokens, source, errors, symbolTable) {
    document.getElementById('tokenCount').textContent = tokens.length;
    document.getElementById('lineCount').textContent = source.split('\n').length;
    document.getElementById('errorCount').textContent = errors.length;
    document.getElementById('symbolCount').textContent = symbolTable.size;

    // Calculate code complexity
    const complexity = calculateComplexity(source);
    
    // Add complexity indicator to stats if needed
    const statsDiv = document.getElementById('stats');
    let complexityCard = document.getElementById('complexityCard');
    
    if (!complexityCard) {
        complexityCard = document.createElement('div');
        complexityCard.id = 'complexityCard';
        complexityCard.className = 'stat-card';
        statsDiv.appendChild(complexityCard);
    }
    
    const complexityColor = complexity <= 5 ? '#04AA6D' : complexity <= 10 ? '#F57C00' : '#F44336';
    complexityCard.innerHTML = `
        <div class="stat-value" style="color: ${complexityColor}">${complexity}</div>
        <div class="stat-label">Complexity</div>
    `;
}

function calculateComplexity(source) {
    // Simple cyclomatic complexity: count decision points
    let complexity = 1; // Base complexity
    
    const keywords = ['if', 'else', 'while', 'for', '&&', '||'];
    keywords.forEach(keyword => {
        const regex = new RegExp('\\b' + keyword + '\\b', 'g');
        const matches = source.match(regex);
        if (matches) {
            complexity += matches.length;
        }
    });
    
    return complexity;
}

function getTokenClass(type) {
    const map = {
        'KEYWORD': 'token-keyword',
        'IDENTIFIER': 'token-identifier',
        'INT_LITERAL': 'token-number',
        'FLOAT_LITERAL': 'token-number',
        'STRING_LITERAL': 'token-string',
        'OPERATOR': 'token-operator',
        'PUNCTUATION': 'token-punctuation'
    };
    return map[type] || '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearAll() {
    document.getElementById('sourceCode').value = '';
    document.getElementById('lexerOutput').innerHTML = '';
    document.getElementById('parserOutput').innerHTML = '';
    document.getElementById('symbolTableOutput').innerHTML = '';
    document.getElementById('errorsOutput').innerHTML = '';
    document.getElementById('tokenCount').textContent = '0';
    document.getElementById('lineCount').textContent = '0';
    document.getElementById('errorCount').textContent = '0';
    document.getElementById('symbolCount').textContent = '0';
}

function loadExample() {
    const example = `// Example Program - Compiler Frontend Demo
// Demonstrates: Variables, Loops, Conditionals, Functions

int x = 10;
int y = 20;
int sum = x + y;

// Conditional statement
if (sum > 25) {
    print(sum);
}

// Different data types
float pi = 3.14159;
string message = "Hello Compiler!";
bool isValid = true;

// While loop
int counter = 0;
while (counter < 5) {
    counter = counter + 1;
}

// For loop
for (int i = 0; i < 10; i = i + 1) {
    print(i);
}

// Return statement
return sum;`;
    
    document.getElementById('sourceCode').value = example;
}

function showNotification(message) {
    // Remove existing notification if any
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    // Create notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-hide after 4 seconds
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function exportResults() {
    const source = document.getElementById('sourceCode').value;
    
    if (!source.trim()) {
        alert('Please compile some code first!');
        return;
    }
    
    // Get all output content
    const lexerOutput = document.getElementById('lexerOutput').innerText;
    const parserOutput = document.getElementById('parserOutput').innerText;
    const symbolTableOutput = document.getElementById('symbolTableOutput').innerText;
    const errorsOutput = document.getElementById('errorsOutput').innerText;
    const stats = {
        tokens: document.getElementById('tokenCount').textContent,
        lines: document.getElementById('lineCount').textContent,
        errors: document.getElementById('errorCount').textContent,
        symbols: document.getElementById('symbolCount').textContent
    };
    
    // Create export content
    const exportContent = `COMPILER FRONTEND - COMPILATION RESULTS
${'='.repeat(60)}

SOURCE CODE:
${'-'.repeat(60)}
${source}

${'='.repeat(60)}
STATISTICS:
${'-'.repeat(60)}
Tokens: ${stats.tokens}
Lines: ${stats.lines}
Errors: ${stats.errors}
Symbols: ${stats.symbols}

${'='.repeat(60)}
LEXICAL ANALYSIS (TOKENS):
${'-'.repeat(60)}
${lexerOutput}

${'='.repeat(60)}
SYNTAX ANALYSIS (AST):
${'-'.repeat(60)}
${parserOutput}

${'='.repeat(60)}
SEMANTIC ANALYSIS (SYMBOL TABLE):
${'-'.repeat(60)}
${symbolTableOutput}

${'='.repeat(60)}
ERRORS & WARNINGS:
${'-'.repeat(60)}
${errorsOutput}

${'='.repeat(60)}
Generated by Compiler Frontend
Date: ${new Date().toLocaleString()}
`;
    
    // Create download
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compilation-results-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('✓ Results exported successfully!');
}
