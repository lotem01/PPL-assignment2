import { map } from "ramda";
import { Program, Exp, CExp, isProgram, isDefineExp, isNumExp, isBoolExp,
         isStrExp, isVarRef, isPrimOp, isProcExp, isIfExp, isAppExp,
         AppExp, ProcExp, isCExp } from "./L3/L3-ast";
import { Result, makeOk, makeFailure, bind, mapv, mapResult } from "./shared/result";

/*
Purpose: Transform L2 AST to Python program string
Signature: l2ToPython(l2AST)
Type: [Parsed | Error] => Result<string>
*/

const primOpToInfix: Record<string, string> = {
    "+": "+", "-": "-", "*": "*", "/": "/",
    "<": "<", ">": ">", "=": "==", "eq?": "=="
};

const primOpStandalone = (op: string): string =>
    op === "number?"  ? "(lambda x : (type(x) == int or type(x) == float))" :
    op === "boolean?" ? "(lambda x : (type(x) == bool))" :
    op === "not"      ? "(lambda x : (not x))" :
    op === "and"      ? "(lambda x, y : (x and y))" :
    op === "or"       ? "(lambda x, y : (x or y))" :
    op === "eq?"      ? "(lambda x, y : (x == y))" :
    op;

const procExpToPython = (exp: ProcExp): Result<string> =>
    mapv(cexpToPython(exp.body[0]), (body: string) => {
        const args = map((v) => v.var, exp.args).join(",");
        return `(lambda ${args} : ${body})`;
    });

const appExpToPython = (exp: AppExp): Result<string> =>
    bind(mapResult(cexpToPython, exp.rands), (rands: string[]) => {
        if (isPrimOp(exp.rator)) {
            const op = exp.rator.op;
            if (op in primOpToInfix)
                return makeOk(`(${rands.join(` ${primOpToInfix[op]} `)})`);
            if (op === "not")
                return makeOk(`(not ${rands[0]})`);
            if (op === "and")
                return makeOk(`(${rands[0]} and ${rands[1]})`);
            if (op === "or")
                return makeOk(`(${rands[0]} or ${rands[1]})`);
            if (op === "number?")
                return makeOk(`(type(${rands[0]}) == int or type(${rands[0]}) == float)`);
            if (op === "boolean?")
                return makeOk(`(type(${rands[0]}) == bool)`);
        }
        if (isProcExp(exp.rator))
            return mapv(procExpToPython(exp.rator), (proc: string) =>
                `${proc}(${rands.join(",")})`);
        // VarRef or other
        return mapv(cexpToPython(exp.rator), (rator: string) =>
            `${rator}(${rands.join(",")})`);
    });

const cexpToPython = (exp: CExp): Result<string> =>
    isNumExp(exp)   ? makeOk(`${exp.val}`) :
    isBoolExp(exp)  ? makeOk(exp.val ? "True" : "False") :
    isStrExp(exp)   ? makeOk(`"${exp.val}"`) :
    isVarRef(exp)   ? makeOk(exp.var) :
    isPrimOp(exp)   ? makeOk(primOpStandalone(exp.op)) :
    isProcExp(exp)  ? procExpToPython(exp) :
    isIfExp(exp)    ?
        bind(cexpToPython(exp.test), (test: string) =>
        bind(cexpToPython(exp.then), (then: string) =>
        mapv(cexpToPython(exp.alt),  (alt: string) =>
            `(${then} if ${test} else ${alt})`))) :
    isAppExp(exp)   ? appExpToPython(exp) :
    makeFailure(`Unknown CExp: ${exp}`);

export const l2ToPython = (exp: Exp | Program): Result<string> =>
    isProgram(exp)   ?
        mapv(mapResult(l2ToPython, exp.exps), (strs: string[]) => strs.join("\n")) :
    isDefineExp(exp) ?
        mapv(cexpToPython(exp.val), (val: string) => `${exp.var.var} = ${val}`) :
    isCExp(exp)      ? cexpToPython(exp) :
    makeFailure(`Unknown exp: ${exp}`);