import { ClassExp, ProcExp, Exp, Program, CExp, Binding,
         makeIfExp, makeAppExp, makeProcExp, makeVarDecl, makeVarRef,
         makeLitExp, makePrimOp, isDefineExp, isProgram, isCExp,
         isClassExp, makeDefineExp, isAtomicExp, isLitExp, isIfExp,
         isAppExp, isProcExp, isLetExp, makeLetExp, makeProgram,
         makeBinding, isBinding } from "./L3-ast";
import { Result, bind, makeFailure, makeOk, mapv } from "../shared/result";
import { makeSymbolSExp } from "./L3-value";
import { map, zipWith } from "ramda";
import { mapResult } from "../shared/result";
import { get } from "node:http";

/*
Purpose: Transform ClassExp to ProcExp
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/

//Helper function
const getMethodBody = (val: CExp): CExp =>
    isProcExp(val) && val.args.length === 0 && val.body.length === 1 ?
        val.body[0] :
        val;

export const class2proc = (exp: ClassExp): ProcExp => {
    //@TODO
    const msgVar = makeVarRef("msg");
    const errorExp = makeLitExp(makeSymbolSExp("error"));

    const methodsBody: CExp = exp.methods.reduceRight(
        (acc: CExp, binding: Binding): CExp =>
            makeIfExp(
                makeAppExp(makePrimOp("eq?"), [
                    msgVar,
                    makeLitExp(makeSymbolSExp(binding.var.var))
                ]),
                getMethodBody(binding.val),
                acc
            ),
        errorExp
    );

    const innerLambda = makeProcExp([makeVarDecl("msg")], [methodsBody]);
    return makeProcExp(exp.fields, [innerLambda]);
}

/*
Purpose: Transform all class forms in the given AST to procs
Signature: transform(AST)
Type: [Exp | Program] => Result<Exp | Program>
*/

export const transform = (exp: Exp | Program): Result<Exp | Program> =>
    //@TODO
    isProgram(exp) ?
        mapv(mapResult(transform, exp.exps) as Result<Exp[]>, (exps: Exp[]) => makeProgram(exps)) :
    isDefineExp(exp) ?
        mapv(transformCExp(exp.val), (val: CExp) => makeDefineExp(exp.var, val)) :
    isCExp(exp) ? transformCExp(exp) :
    makeFailure(`Unknown exp: ${exp}`);

const transformCExp = (exp: CExp): Result<CExp> =>
    isAtomicExp(exp) ? makeOk(exp) :
    isLitExp(exp)    ? makeOk(exp) :
    isClassExp(exp)  ? makeOk(class2proc(exp)) :
    isIfExp(exp) ?
        mapv(mapResult(transformCExp, [exp.test, exp.then, exp.alt]),
             ([test, then, alt]) => makeIfExp(test, then, alt)) :
    isAppExp(exp) ?
        bind(transformCExp(exp.rator), (rator: CExp) =>
        mapv(mapResult(transformCExp, exp.rands), (rands: CExp[]) =>
             makeAppExp(rator, rands))) :
    isProcExp(exp) ?
        mapv(mapResult(transformCExp, exp.body), (body: CExp[]) =>
             makeProcExp(exp.args, body)) :
    isLetExp(exp) ?
    bind(
        mapResult(transformCExp, map(b => b.val, exp.bindings)),
        (vals: CExp[]) =>
            mapv(
                mapResult(transformCExp, exp.body),
                (body: CExp[]) =>
                    makeLetExp(
                        zipWith(
                            (b: Binding, v: CExp) => makeBinding(b.var.var, v),
                            exp.bindings,
                            vals
                        ),
                        body
                    )
            )
    ) :
    makeFailure(`Unknown CExp: ${exp}`);