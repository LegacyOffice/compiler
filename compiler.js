// ============================================================================
// LEXER (Lexical Analyzer)
// ============================================================================

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
            'int', 'float', 'string', 'bool',
            'if', 'else', 'while', 'for',
            'return', 'print', 'true', 'false',
            'function', 'void', 'break', 'continue'
        ]);
    }

    currentChar() {
        return this.position < this.source.length ? this.source[this.position] : null;
    }

    peek(offset = 1) {
        const pos = this.position + offset;
        return pos < this.source.length ? this.source[pos] : null;
    }

    advance() {
        if (this.currentChar() === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
    }

    skipWhitespace() {
        while (this.currentChar() && /\s/.test(this.currentChar())) {
            this.advance();
        }
    }

    skipComment() {
        if (this.currentChar() === '/' && this.peek() === '/') {
            while (this.currentChar() && this.currentChar() !== '\n') {
                this.advance();
            }
        }
    }

    readNumber() {
        let num = '';
        const startLine = this.line;
        const startCol = this.column;
        let hasDecimal = false;

        while (this.currentChar() && (/\d/.test(this.currentChar()) || this.currentChar() === '.')) {
            if (this.currentChar() === '.') {
                if (hasDecimal) {
                    this.errors.push({
                        type: 'Lexical Error',
                        message: 'Invalid number format: multiple decimal points',
                        line: this.line,
                        column: this.column
                    });
                    break;
                }
                hasDecimal = true;
            }
            num += this.currentChar();
            this.advance();
        }

        return new Token(
            hasDecimal ? 'FLOAT_LITERAL' : 'INT_LITERAL',
            num,
            startLine,
            startCol
        );
    }

    readIdentifier() {
        let id = '';
        const startLine = this.line;
        const startCol = this.column;

        while (this.currentChar() && /[a-zA-Z0-9_]/.test(this.currentChar())) {
            id += this.currentChar();
            this.advance();
        }

        const type = this.keywords.has(id) ? 'KEYWORD' : 'IDENTIFIER';
        return new Token(type, id, startLine, startCol);
    }

    readString() {
        let str = '';
        const startLine = this.line;
        const startCol = this.column;
        const quote = this.currentChar();
        
        this.advance(); // Skip opening quote

        while (this.currentChar() && this.currentChar() !== quote) {
            if (this.currentChar() === '\\') {
                this.advance();
                if (this.currentChar()) {
                    str += this.currentChar();
                    this.advance();
                }
            } else {
                str += this.currentChar();
                this.advance();
            }
        }

        if (this.currentChar() === quote) {
            this.advance(); // Skip closing quote
        } else {
            this.errors.push({
                type: 'Lexical Error',
                message: 'Unterminated string literal',
                line: startLine,
                column: startCol
            });
        }

        return new Token('STRING_LITERAL', str, startLine, startCol);
    }

    readOperator() {
        const startLine = this.line;
        const startCol = this.column;
        let op = this.currentChar();
        this.advance();

        // Check for two-character operators
        const twoChar = op + (this.currentChar() || '');
        if (['==', '!=', '<=', '>=', '&&', '||', '++', '--'].includes(twoChar)) {
            op = twoChar;
            this.advance();
        }

        return new Token('OPERATOR', op, startLine, startCol);
    }

    tokenize() {
        while (this.position < this.source.length) {
            this.skipWhitespace();
            
            if (!this.currentChar()) break;

            // Skip comments
            if (this.currentChar() === '/' && this.peek() === '/') {
                this.skipComment();
                continue;
            }

            const char = this.currentChar();

            // Numbers
            if (/\d/.test(char)) {
                this.tokens.push(this.readNumber());
            }
            // Identifiers and Keywords
            else if (/[a-zA-Z_]/.test(char)) {
                this.tokens.push(this.readIdentifier());
            }
            // Strings
            else if (char === '"' || char === "'") {
                this.tokens.push(this.readString());
            }
            // Operators
            else if ('+-*/<>=!&|'.includes(char)) {
                this.tokens.push(this.readOperator());
            }
            // Punctuation
            else if ('(){}[];,'.includes(char)) {
                this.tokens.push(new Token('PUNCTUATION', char, this.line, this.column));
                this.advance();
            }
            // Unknown character
            else {
                this.errors.push({
                    type: 'Lexical Error',
                    message: `Unknown character: '${char}'`,
                    line: this.line,
                    column: this.column
                });
                this.advance();
            }
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
// SEMANTIC ANALYZER
// ============================================================================

class SemanticAnalyzer {
    constructor(ast) {
        this.ast = ast;
        this.symbolTable = new Map();
        this.errors = [];
        this.warnings = [];
    }

    analyze() {
        this.visit(this.ast);
        return {
            symbolTable: this.symbolTable,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    visit(node) {
        if (!node) return;

        switch (node.type) {
            case 'Program':
                node.children.forEach(child => this.visit(child));
                break;
            case 'Declaration':
                this.visitDeclaration(node);
                break;
            case 'Assignment':
                this.visitAssignment(node);
                break;
            case 'IfStatement':
            case 'WhileStatement':
            case 'ForStatement':
                node.children.forEach(child => this.visit(child));
                break;
            case 'PrintStatement':
            case 'ReturnStatement':
                if (node.children.length > 0) {
                    this.visit(node.children[0]);
                }
                break;
            case 'BinaryOp':
                this.visitBinaryOp(node);
                break;
            case 'Identifier':
                this.visitIdentifier(node);
                break;
            case 'Body':
                node.children.forEach(child => this.visit(child));
                break;
        }
    }

    visitDeclaration(node) {
        const type = node.children[0].value;
        const name = node.children[1].value;

        if (this.symbolTable.has(name)) {
            this.errors.push({
                type: 'Semantic Error',
                message: `Variable '${name}' already declared`,
                line: 0,
                column: 0
            });
        } else {
            this.symbolTable.set(name, {
                type: type,
                initialized: node.children.length > 2,
                used: false,
                line: 0
            });
        }

        // Check initialization expression
        if (node.children.length > 2) {
            this.visit(node.children[2]);
        }
    }

    visitAssignment(node) {
        const name = node.children[0].value;

        if (!this.symbolTable.has(name)) {
            this.errors.push({
                type: 'Semantic Error',
                message: `Variable '${name}' used before declaration`,
                line: 0,
                column: 0
            });
        } else {
            const symbol = this.symbolTable.get(name);
            symbol.initialized = true;
        }

        this.visit(node.children[1]);
    }

    visitBinaryOp(node) {
        this.visit(node.children[0]);
        this.visit(node.children[1]);
    }

    visitIdentifier(node) {
        const name = node.value;

        if (!this.symbolTable.has(name)) {
            this.errors.push({
                type: 'Semantic Error',
                message: `Variable '${name}' not declared`,
                line: 0,
                column: 0
            });
        } else {
            const symbol = this.symbolTable.get(name);
            symbol.used = true;

            if (!symbol.initialized) {
                this.warnings.push({
                    type: 'Semantic Warning',
                    message: `Variable '${name}' used before initialization`,
                    line: 0,
                    column: 0
                });
            }
        }
    }
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function compile() {
    const source = document.getElementById('sourceCode').value;
    
    if (!source.trim()) {
        alert('Please enter some code to compile!');
        return;
    }

    // Clear previous outputs
    document.getElementById('lexerOutput').innerHTML = '';
    document.getElementById('parserOutput').innerHTML = '';
    document.getElementById('symbolTableOutput').innerHTML = '';
    document.getElementById('errorsOutput').innerHTML = '';

    let allErrors = [];

    // LEXER
    const lexer = new Lexer(source);
    const { tokens, errors: lexerErrors } = lexer.tokenize();
    allErrors = allErrors.concat(lexerErrors);
    displayTokens(tokens);

    // PARSER
    const parser = new Parser(tokens);
    const { ast, errors: parserErrors } = parser.parse();
    allErrors = allErrors.concat(parserErrors);
    displayAST(ast);

    // SEMANTIC ANALYZER
    const analyzer = new SemanticAnalyzer(ast);
    const { symbolTable, errors: semanticErrors, warnings } = analyzer.analyze();
    allErrors = allErrors.concat(semanticErrors);
    displaySymbolTable(symbolTable);
    displayErrors(allErrors, warnings);

    // Update statistics
    updateStats(tokens, source, allErrors, symbolTable);

    // Show notification
    showNotification('✓ Compilation Complete! Check the results below.');
}

function displayTokens(tokens) {
    const output = document.getElementById('lexerOutput');
    
    if (tokens.length === 0) {
        output.innerHTML = '<div class="warning">No tokens generated</div>';
        return;
    }

    let html = '<div style="line-height: 2;">';
    tokens.forEach(token => {
        const className = getTokenClass(token.type);
        html += `<span class="token ${className}" title="Line ${token.line}, Col ${token.column}">
            ${token.type}: ${escapeHtml(token.value)}
        </span>`;
    });
    html += '</div>';
    output.innerHTML = html;
}

function displayAST(ast, indent = 0) {
    const output = document.getElementById('parserOutput');
    output.innerHTML = renderAST(ast, 0);
}

function renderAST(node, indent) {
    if (!node) return '';
    
    let html = '<div class="ast-node">';
    html += `<strong>${node.type}</strong>`;
    if (node.value) {
        html += `: <code>${escapeHtml(node.value)}</code>`;
    }
    
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            html += renderAST(child, indent + 1);
        });
    }
    
    html += '</div>';
    return html;
}

function displaySymbolTable(symbolTable) {
    const output = document.getElementById('symbolTableOutput');
    
    if (symbolTable.size === 0) {
        output.innerHTML = '<div class="warning">No symbols in table</div>';
        return;
    }

    let html = '<table class="symbol-table">';
    html += '<tr><th>Name</th><th>Type</th><th>Initialized</th><th>Used</th></tr>';
    
    symbolTable.forEach((info, name) => {
        html += `<tr>
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
