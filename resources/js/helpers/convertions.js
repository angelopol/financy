export function ConvertAmount(amount, currency, rates) {
    amount = parseFloat(amount);
    if (currency == 'bs') {
        amount = amount / rates.parallel;
    } else if (currency == '$bcv') {
        amount = (amount * rates.bcv) / rates.parallel;
    }
    return parseFloat(amount.toFixed(2));
}

export function GetDollarRates(amount, rates){
    return {
        bcv: parseFloat((amount * rates.bcv).toFixed(2)),
        parallel: parseFloat((amount * rates.parallel).toFixed(2))
    };
}