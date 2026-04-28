// ============================================================================
// ADVANCED FEATURES - Code Optimization & Analysis
// ============================================================================

class CodeOptimizer {
    constructor(ast) {
        this.ast = ast;
        this.optimizations = [];
    }

    optimize() {
        this.detectConstantFolding(this.ast);
        this.detectDeadCode(this.ast);
        this.detectUnusedVariables(this.ast);
        return this.optimizations;
    }

    detectConstantFolding(node) {
        if (!node) return;

        // Detect constant expressions that can be pre-computed
        if (node.type === 'BinaryOp' && 
            node.children[0]?.type === 'Literal' && 
            node.children[1]?.type === 'Literal') {
            
            const left = parseFloat(node.children[0].value);
            const right = parseFloat(node.children[1].value);
            let result;

            switch(node.value) {
                case '+': result = left + right; break;
                case '-': result = left - right; break;
                case '*': result = left * right; break;
                case '/': result = left / right; break;
            }

            if (result !== undefined) {
                this.optimizations.push({
                    type: 'Constant Folding',
                    message: `Expression '${left} ${node.value} ${right}' can be replaced with '${result}'`,
                    severity: 'info'
                });
            }
        }

        // Recursively check children
        if (node.children) {
            node.children.forEach(child => this.detectConstantFolding(child));
        }
    }

    detectDeadCode(node) {
        if (!node) return;

        // Detect unreachable code after return
        if (node.type === 'Body') {
            let foundReturn = false;
            node.children.forEach((child, index) => {
                if (foundReturn) {
                    this.optimizations.push({
                        type: 'Dead Code',
                        message: `Unreachable code detected after return statement`,
                        severity: 'warning'
                    });
                }
                if (child.type === 'ReturnStatement') {
                    foundReturn = true;
                }
            });
        }

        if (node.children) {
            node.children.forEach(child => this.detectDeadCode(child));
        }
    }

    detectUnusedVariables(node) {
        // This will be populated by semantic analyzer
        // Just a placeholder for the structure
    }
}

class ControlFlowAnalyzer {
    constructor(ast) {
        this.ast = ast;
        this.warnings = [];
    }

    analyze() {
        this.checkInfiniteLoops(this.ast);
        this.checkUnreachableCode(this.ast);
        return this.warnings;
    }

    checkInfiniteLoops(node) {
        if (!node) return;

        // Detect while(true) or similar patterns
        if (node.type === 'WhileStatement') {
            const condition = node.children[0];
            if (condition?.type === 'Identifier' && condition.value === 'true') {
                this.warnings.push({
                    type: 'Control Flow Warning',
                    message: 'Potential infinite loop detected',
                    severity: 'warning'
                });
            }
        }

        if (node.children) {
            node.children.forEach(child => this.checkInfiniteLoops(child));
        }
    }

    checkUnreachableCode(node) {
        // Check for code after return statements
        if (node?.type === 'Body') {
            let hasReturn = false;
            node.children.forEach(child => {
                if (hasReturn && child.type !== 'ReturnStatement') {
                    this.warnings.push({
                        type: 'Control Flow Warning',
                        message: 'Unreachable code after return statement',
                        severity: 'warning'
                    });
                }
                if (child.type === 'ReturnStatement') {
                    hasReturn = true;
                }
            });
        }

        if (node?.children) {
            node.children.forEach(child => this.checkUnreachableCode(child));
        }
    }
}

// ============================================================================
// ENHANCED UI FUNCTIONS
// ============================================================================

function compileAdvanced() {
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
    document.getElementById('optimizationsOutput').innerHTML = '';

    let allErrors = [];
    let allWarnings = [];

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
    allWarnings = allWarnings.concat(warnings);
    displaySymbolTable(symbolTable);

    // CODE OPTIMIZER
    const optimizer = new CodeOptimizer(ast);
    const optimizations = optimizer.optimize();
    displayOptimizations(optimizations);

    // CONTROL FLOW ANALYZER
    const flowAnalyzer = new ControlFlowAnalyzer(ast);
    const flowWarnings = flowAnalyzer.analyze();
    allWarnings = allWarnings.concat(flowWarnings);

    displayErrors(allErrors, allWarnings);

    // Update statistics
    updateStats(tokens, source, allErrors, symbolTable);
}

function displayOptimizations(optimizations) {
    const output = document.getElementById('optimizationsOutput');
    
    if (!output) return; // If section doesn't exist yet
    
    if (optimizations.length === 0) {
        output.innerHTML = '<div class="success">✅ No optimizations suggested</div>';
        return;
    }

    let html = '';
    optimizations.forEach(opt => {
        const className = opt.severity === 'warning' ? 'warning' : 'success';
        html += `<div class="${className}">
            <strong>${opt.type}</strong>: ${opt.message}
        </div>`;
    });

    output.innerHTML = html;
}

// Export for use in main compiler
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CodeOptimizer, ControlFlowAnalyzer };
}
