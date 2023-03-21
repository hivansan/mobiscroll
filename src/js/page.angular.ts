
import {
    Component,
    Input,
    ElementRef,
    NgZone,
    OnInit,
    ViewChild,
    NgModule,
} from '@angular/core';
import {
    extend,
    MbscBase,
    MbscBaseModule,
    MbscOptionsService,
} from './frameworks/angular';

import { Page, MbscPageOptions } from './classes/page';
export { MbscPageOptions };

@Component({
    selector: 'mbsc-page',
    template: '<div #initElement><ng-content></ng-content></div>',
    providers: [MbscOptionsService],
    exportAs: 'mobiscroll'
})
export class MbscPage extends MbscBase implements OnInit {
    instance: Page;

    @Input()
    options: MbscPageOptions;

    @Input()
    context: string | HTMLElement;

    @ViewChild('initElement', { static: false } as any)
    initElem: ElementRef;

    constructor(hostElement: ElementRef, public optionsService: MbscOptionsService, zone: NgZone) {
        super(hostElement, zone);
    }

    ngOnInit() {
        let optionsObj = extend({}, this.options, this.inlineOptionsObj);
        this.optionsService.options = optionsObj;
    }

    initControl() {
        let options = extend({}, this.options, this.inlineOptionsObj);
        this.instance = new Page(this.initElem.nativeElement, options);
    }
}

@Component({
    selector: 'mbsc-note',
    template: '<ng-content></ng-content>',
    host: {
        '[class]': 'classNames'
    },
    styles: [':host { display: block; }']
})
export class MbscNote {
    get classNames(): string {
        return 'mbsc-note mbsc-note-' + this.color;
    }

    @Input()
    color: string = 'primary';

    constructor(public initialElem: ElementRef) {
    }
}

@Component({
    selector: 'mbsc-avatar',
    template: '<img class="mbsc-avatar" [src]="src" [alt]="alt" [draggable]="draggable" />'
})
export class MbscAvatar {
    @Input()
    draggable: boolean = false;
    @Input()
    src: string;
    @Input()
    alt: string;
}

@NgModule({
    imports: [MbscBaseModule],
    declarations: [MbscPage, MbscNote, MbscAvatar],
    exports: [MbscPage, MbscNote, MbscAvatar]
})
export class MbscPageModule { }